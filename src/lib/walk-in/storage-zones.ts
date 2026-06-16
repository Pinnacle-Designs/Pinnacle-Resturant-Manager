import { prisma } from "@/lib/prisma";
import { DEFAULT_STORAGE_ZONES, slugifyZoneName } from "./storage-zone-constants";

export { DEFAULT_STORAGE_ZONES, slugifyZoneName } from "./storage-zone-constants";

export async function uniqueZoneSlug(locationId: string, name: string): Promise<string> {
  const base = slugifyZoneName(name);
  let slug = base;
  let n = 1;
  while (await prisma.storageZone.findFirst({ where: { locationId, slug } })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

/** Create default zones for a location if none exist for each default slug. */
export async function ensureDefaultStorageZones(locationId: string) {
  const existing = await prisma.storageZone.findMany({
    where: { locationId },
    select: { slug: true },
  });
  const slugs = new Set(existing.map((z) => z.slug));

  for (const zone of DEFAULT_STORAGE_ZONES) {
    if (slugs.has(zone.slug)) continue;
    await prisma.storageZone.create({
      data: { locationId, name: zone.name, slug: zone.slug, sortOrder: zone.sortOrder },
    });
  }
}

/** Keep shelf-to-sheet route in sync when an item's storage zone changes. */
export async function syncRouteStepForItem(inventoryItemId: string, zoneId: string | null) {
  await prisma.countRouteStep.deleteMany({ where: { inventoryItemId } });
  if (!zoneId) return;

  const max = await prisma.countRouteStep.aggregate({
    where: { zoneId },
    _max: { sortOrder: true },
  });

  await prisma.countRouteStep.create({
    data: {
      zoneId,
      inventoryItemId,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
}
