import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_social");
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const account = await prisma.socialAccount.update({
    where: { id },
    data: {
      ...(body.accountName !== undefined && { accountName: body.accountName }),
      ...(body.followers !== undefined && { followers: body.followers }),
      ...(body.connected !== undefined && { connected: body.connected }),
      ...(body.connected === true && { lastSyncedAt: new Date() }),
    },
  });

  return NextResponse.json(account);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_social");
  if (error) return error;

  const { id } = await params;
  await prisma.socialAccount.update({
    where: { id },
    data: { connected: false },
  });

  return NextResponse.json({ success: true });
}
