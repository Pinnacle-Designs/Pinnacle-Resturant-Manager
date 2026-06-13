import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { getWeekStart, getWeekEnd } from "@/lib/schedule";
import { requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_schedule");
  if (error) return error;
  const locationId = await getLocationIdFromRequest(request);
  const weekParam = request.nextUrl.searchParams.get("weekStart");

  const weekStart = weekParam ? new Date(weekParam) : getWeekStart();
  const weekEnd = getWeekEnd(weekStart);

  const shifts = await prisma.shift.findMany({
    where: {
      locationId,
      date: { gte: weekStart, lte: weekEnd },
    },
    include: { staffMember: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    shifts: shifts.map((s) => ({
      ...s,
      date: s.date.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_schedule");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  const staff = await prisma.staffMember.findFirst({
    where: { id: body.staffMemberId, locationId },
  });
  if (!staff) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  const shift = await prisma.shift.create({
    data: {
      locationId,
      staffMemberId: body.staffMemberId,
      date: new Date(body.date),
      startTime: body.startTime,
      endTime: body.endTime,
      notes: body.notes || null,
    },
    include: { staffMember: true },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "CREATE",
      entity: "shift",
      entityId: shift.id,
      details: `Scheduled ${staff.name}: ${body.startTime}–${body.endTime}`,
    },
  });

  return NextResponse.json({ ...shift, date: shift.date.toISOString() });
}
