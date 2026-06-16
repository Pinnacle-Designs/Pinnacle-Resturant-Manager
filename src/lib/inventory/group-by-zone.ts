import type { InventoryItem } from "@/components/inventory/types";

export interface InventoryZoneSection {
  zoneId: string | null;
  zoneName: string;
  slug: string | null;
  sortOrder: number;
  items: InventoryItem[];
  lowStockCount: number;
}

interface ZoneMeta {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

const UNASSIGNED_SORT = 9999;

/** Group inventory items by storage zone — walk-in, freezer, dry, etc. stay together. */
export function groupInventoryByZone(
  items: InventoryItem[],
  zones: ZoneMeta[]
): InventoryZoneSection[] {
  const byZone = new Map<string | null, InventoryItem[]>();

  for (const item of items) {
    const key = item.storageZoneId ?? null;
    const list = byZone.get(key) ?? [];
    list.push(item);
    byZone.set(key, list);
  }

  const zoneMeta = new Map<string, ZoneMeta>();
  for (const z of zones) zoneMeta.set(z.id, z);
  for (const item of items) {
    if (!item.storageZoneId || zoneMeta.has(item.storageZoneId)) continue;
    zoneMeta.set(item.storageZoneId, {
      id: item.storageZoneId,
      name: item.storageZone?.name ?? "Storage zone",
      slug: item.storageZone?.slug ?? item.storageZoneId,
      sortOrder: 5000,
    });
  }

  const sortItems = (list: InventoryItem[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name));

  const sections: InventoryZoneSection[] = [];

  for (const zone of [...zoneMeta.values()].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const zoneItems = sortItems(byZone.get(zone.id) ?? []);
    if (zoneItems.length === 0) continue;
    sections.push({
      zoneId: zone.id,
      zoneName: zone.name,
      slug: zone.slug,
      sortOrder: zone.sortOrder,
      items: zoneItems,
      lowStockCount: zoneItems.filter((i) => i.quantity <= i.minQuantity).length,
    });
  }

  const unassigned = sortItems(byZone.get(null) ?? []);
  if (unassigned.length > 0) {
    sections.push({
      zoneId: null,
      zoneName: "Unassigned",
      slug: null,
      sortOrder: UNASSIGNED_SORT,
      items: unassigned,
      lowStockCount: unassigned.filter((i) => i.quantity <= i.minQuantity).length,
    });
  }

  return sections;
}

export function zoneSectionAccent(slug: string | null): string {
  switch (slug) {
    case "walk-in":
      return "border-sky-200 bg-sky-50/50";
    case "freezer":
      return "border-indigo-200 bg-indigo-50/50";
    case "dry":
      return "border-amber-200 bg-amber-50/50";
    case "bar":
      return "border-violet-200 bg-violet-50/50";
    default:
      return "border-slate-200 bg-slate-50/50";
  }
}
