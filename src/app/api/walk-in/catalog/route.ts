import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { parseAlternateUnits } from "@/lib/walk-in/unit-convert";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_inventory");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);

  const items = await prisma.inventoryItem.findMany({
    where: { locationId },
    include: { storageZone: true },
    orderBy: { name: "asc" },
  });

  const zones = await prisma.storageZone.findMany({
    where: { locationId },
    include: {
      routeSteps: {
        include: { inventoryItem: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const lots = await prisma.inventoryLot.findMany({
    where: { locationId, quantity: { gt: 0 } },
    include: { inventoryItem: true, zone: true },
    orderBy: { receivedAt: "asc" },
  });

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      barcode: i.barcode,
      quantity: i.quantity,
      unit: i.unit,
      storageZoneId: i.storageZoneId,
      storageZone: i.storageZone?.name,
      alternateUnits: parseAlternateUnits(i.alternateUnits),
      countByWeight: i.countByWeight,
    })),
    zones,
    lots: lots.map((l) => ({
      id: l.id,
      inventoryItemId: l.inventoryItemId,
      itemName: l.inventoryItem.name,
      quantity: l.quantity,
      unit: l.unit,
      expiresAt: l.expiresAt,
      receivedAt: l.receivedAt,
      zoneName: l.zone?.name,
    })),
    cachedAt: new Date().toISOString(),
  });
}
