import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_schedule");
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const shift = await prisma.shift.update({
    where: { id },
    data: {
      staffMemberId: body.staffMemberId,
      date: body.date ? new Date(body.date) : undefined,
      startTime: body.startTime,
      endTime: body.endTime,
      workRole: body.workRole !== undefined ? body.workRole || null : undefined,
      notes: body.notes,
    },
    include: { staffMember: true },
  });

  return NextResponse.json({ ...shift, date: shift.date.toISOString() });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_schedule");
  if (error) return error;

  const { id } = await params;
  await prisma.shift.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
