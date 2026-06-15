import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_schedule");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const where: { locationId: string; clockInAt?: { gte?: Date; lte?: Date } } = {
    locationId,
  };
  if (from) where.clockInAt = { ...where.clockInAt, gte: new Date(from) };
  if (to) where.clockInAt = { ...where.clockInAt, lte: new Date(to) };

  const entries = await prisma.timeEntry.findMany({
    where,
    include: { staffMember: { select: { id: true, name: true, role: true } } },
    orderBy: { clockInAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      clockInAt: e.clockInAt.toISOString(),
      clockOutAt: e.clockOutAt?.toISOString() ?? null,
      breakAttestedAt: e.breakAttestedAt?.toISOString() ?? null,
    })),
  });
}
