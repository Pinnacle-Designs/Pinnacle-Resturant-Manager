import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_social");
  if (error) return error;

  const { id } = await params;
  await prisma.socialPost.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
