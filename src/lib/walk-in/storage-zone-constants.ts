export const DEFAULT_STORAGE_ZONES = [
  { name: "Walk-In Cooler", slug: "walk-in", sortOrder: 0 },
  { name: "Dry Storage", slug: "dry", sortOrder: 1 },
  { name: "Freezer", slug: "freezer", sortOrder: 2 },
  { name: "Bar Cooler", slug: "bar", sortOrder: 3 },
] as const;

export function slugifyZoneName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "zone";
}
