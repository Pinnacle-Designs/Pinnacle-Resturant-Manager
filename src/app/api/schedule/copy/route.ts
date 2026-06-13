import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { addWeeks, getWeekStart, getWeekEnd } from "@/lib/schedule";
import { requirePermission } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_schedule");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const targetWeekStart = body.weekStart ? new Date(body.weekStart) : getWeekStart();

  const existing = await prisma.shift.findMany({
    where: {
      locationId,
      date: { gte: targetWeekStart, lte: getWeekEnd(targetWeekStart) },
    },
  });
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "This week already has shifts. Clear them first or edit individually." },
      { status: 400 }
    );
  }

  const sourceWeekStart = addWeeks(targetWeekStart, -1);
  const sourceWeekEnd = getWeekEnd(sourceWeekStart);

  const sourceShifts = await prisma.shift.findMany({
    where: {
      locationId,
      date: { gte: sourceWeekStart, lte: sourceWeekEnd },
    },
  });

  if (sourceShifts.length === 0) {
    return NextResponse.json({ error: "No shifts in the previous week to copy" }, { status: 400 });
  }

  const created = await prisma.shift.createMany({
    data: sourceShifts.map((s) => {
      const dayOffset = Math.round(
        (s.date.getTime() - sourceWeekStart.getTime()) / (24 * 60 * 60 * 1000)
      );
      const newDate = new Date(targetWeekStart);
      newDate.setDate(newDate.getDate() + dayOffset);

      return {
        locationId,
        staffMemberId: s.staffMemberId,
        date: newDate,
        startTime: s.startTime,
        endTime: s.endTime,
        notes: s.notes,
      };
    }),
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "COPY",
      entity: "schedule",
      details: `Copied ${created.count} shifts from previous week`,
    },
  });

  return NextResponse.json({ count: created.count });
}
