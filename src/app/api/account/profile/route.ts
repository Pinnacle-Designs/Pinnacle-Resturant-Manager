import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const body = await request.json();
  const name = String(body.name || "").trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user!.id },
    data: { name },
    select: { id: true, name: true, email: true, avatarUrl: true, role: true },
  });

  return NextResponse.json({ user: updated });
}
