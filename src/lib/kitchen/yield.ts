/** Client-safe yield helpers (no server/DB imports). */

export function formatYieldNote(rawQty: number, yieldPct: number, unit: string): string {
  const sellable = rawQty * (yieldPct / 100);
  return `${rawQty} ${unit} raw → ${sellable.toFixed(1)} ${unit} sellable (${yieldPct}% yield)`;
}
