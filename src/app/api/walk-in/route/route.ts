import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";

export async function PATCH(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_inventory");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const zoneId = body.zoneId as string;
  const steps = body.steps as { inventoryItemId: string; sortOrder: number }[];

  if (!zoneId || !Array.isArray(steps)) {
    return NextResponse.json({ error: "zoneId and steps required" }, { status: 400 });
  }

  const zone = await prisma.storageZone.findFirst({ where: { id: zoneId, locationId } });
  if (!zone) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  await prisma.countRouteStep.deleteMany({ where: { zoneId } });

  await prisma.countRouteStep.createMany({
    data: steps.map((s, idx) => ({
      zoneId,
      inventoryItemId: s.inventoryItemId,
      sortOrder: s.sortOrder ?? idx,
    })),
  });

  const route = await prisma.countRouteStep.findMany({
    where: { zoneId },
    include: { inventoryItem: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ route });
}
