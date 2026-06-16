/** Client-safe portion / yield formatting for kitchen displays. */

export function roundKitchenQty(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Human label for a recipe line quantity vs standard inventory portion. */
export function formatPortionLabel(
  qty: number,
  unit: string,
  portionSize?: number | null
): string {
  const q = roundKitchenQty(qty);
  if (!portionSize || portionSize <= 0) {
    return `${q} ${unit}`;
  }
  const portions = q / portionSize;
  const pSize = roundKitchenQty(portionSize);
  if (Math.abs(portions - 1) < 0.08) {
    return `1 portion — ${pSize} ${unit}`;
  }
  if (portions > 1.05) {
    return `${roundKitchenQty(portions)} portions — ${q} ${unit} total (${pSize} ${unit} each)`;
  }
  return `${q} ${unit} (${roundKitchenQty(portions * 100)}% of ${pSize} ${unit} portion)`;
}

/** Scale a per-plate recipe line to a forecast plate count. */
export function scaleRecipeQty(perPlate: number, plates: number): number {
  return roundKitchenQty(perPlate * plates);
}
