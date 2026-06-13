import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, stripSalaries } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requirePermission(request, "edit_staff");
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const member = await prisma.staffMember.update({
    where: { id },
    data: {
      name: body.name,
      role: body.role,
      email: body.email,
      phone: body.phone,
      hourlyRate: body.hourlyRate,
      active: body.active,
      imageUrl: body.imageUrl,
    },
  });

  return NextResponse.json(stripSalaries(user!.role, [member])[0]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "edit_staff");
  if (error) return error;

  const { id } = await params;
  await prisma.staffMember.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
