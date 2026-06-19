/** Normalize text for case-insensitive substring search. */
export function normalizeSearchText(value: string): string {
  return value.toLowerCase().trim();
}

export function matchesSearchQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return fields.some((field) => field != null && normalizeSearchText(String(field)).includes(q));
}

export function filterBySearchQuery<T>(
  items: T[],
  query: string,
  getFields: (item: T) => (string | null | undefined)[]
): T[] {
  const q = normalizeSearchText(query);
  if (!q) return items;
  return items.filter((item) => matchesSearchQuery(q, ...getFields(item)));
}
