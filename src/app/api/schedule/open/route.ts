import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";

/** Post an open shift for employees to bid on. */
export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_schedule");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  const shift = await prisma.shift.create({
    data: {
      locationId,
      staffMemberId: null,
      date: new Date(body.date),
      startTime: body.startTime,
      endTime: body.endTime,
      workRole: body.workRole || null,
      notes: body.notes || null,
      isOpen: true,
    },
  });

  return NextResponse.json({ ...shift, date: shift.date.toISOString() });
}
