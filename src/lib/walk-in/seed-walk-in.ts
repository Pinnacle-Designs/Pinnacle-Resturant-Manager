import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { defaultAlternatesForUnit } from "./unit-convert";

const DEFAULT_ZONES = [
  { name: "Walk-In Cooler", slug: "walk-in", sortOrder: 0 },
  { name: "Dry Storage", slug: "dry", sortOrder: 1 },
  { name: "Freezer", slug: "freezer", sortOrder: 2 },
  { name: "Bar Cooler", slug: "bar", sortOrder: 3 },
];

export async function seedWalkInSample(locationId: string) {
  const existing = await prisma.storageZone.count({ where: { locationId } });
  if (existing > 0) return;

  const zones = [];
  for (const z of DEFAULT_ZONES) {
    const zone = await prisma.storageZone.create({
      data: { locationId, ...z },
    });
    zones.push(zone);
  }

  const walkIn = zones.find((z) => z.slug === "walk-in")!;
  const dry = zones.find((z) => z.slug === "dry")!;

  const inventory = await prisma.inventoryItem.findMany({
    where: { locationId },
    orderBy: { name: "asc" },
  });

  for (const [idx, item] of inventory.entries()) {
    const zoneId = idx % 3 === 0 ? walkIn.id : idx % 3 === 1 ? dry.id : null;
    const alternates = defaultAlternatesForUnit(item.unit);
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        storageZoneId: zoneId,
        alternateUnits: alternates.length ? JSON.stringify(alternates) : null,
        countByWeight: ["lbs", "oz", "kg"].includes(item.unit),
      },
    });
  }

  const walkInItems = inventory.filter((_, i) => i % 3 === 0).slice(0, 12);
  for (const [sortOrder, item] of walkInItems.entries()) {
    await prisma.countRouteStep.create({
      data: {
        zoneId: walkIn.id,
        inventoryItemId: item.id,
        sortOrder,
      },
    });
  }

  const dryItems = inventory.filter((_, i) => i % 3 === 1).slice(0, 8);
  for (const [sortOrder, item] of dryItems.entries()) {
    await prisma.countRouteStep.create({
      data: {
        zoneId: dry.id,
        inventoryItemId: item.id,
        sortOrder,
      },
    });
  }

  const now = new Date();
  for (const [idx, item] of inventory.slice(0, 6).entries()) {
    await prisma.inventoryLot.create({
      data: {
        locationId,
        inventoryItemId: item.id,
        zoneId: idx % 2 === 0 ? walkIn.id : dry.id,
        lotNumber: `LOT-${1000 + idx}`,
        quantity: Math.max(item.quantity * 0.4, 1),
        unit: item.unit,
        receivedAt: addDays(now, -7 - idx),
        expiresAt: addDays(now, idx === 0 ? -1 : idx === 1 ? 2 : 14),
      },
    });
    if (idx < 3) {
      await prisma.inventoryLot.create({
        data: {
          locationId,
          inventoryItemId: item.id,
          zoneId: walkIn.id,
          lotNumber: `LOT-${2000 + idx}`,
          quantity: Math.max(item.quantity * 0.3, 1),
          unit: item.unit,
          receivedAt: addDays(now, -2),
          expiresAt: addDays(now, 10),
        },
      });
    }
  }
}
