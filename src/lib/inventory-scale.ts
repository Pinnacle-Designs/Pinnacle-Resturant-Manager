/** Parse weight lines from USB/serial kitchen scales (common formats). */
import { convertQuantity } from "@/lib/walk-in/unit-convert";

export function parseScaleWeightLine(line: string): { value: number; unit: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const patterns = [
    /(-?\d+(?:\.\d+)?)\s*(kg|kilograms?)/i,
    /(-?\d+(?:\.\d+)?)\s*(lb|lbs|pounds?)/i,
    /(-?\d+(?:\.\d+)?)\s*(g|grams?)/i,
    /(-?\d+(?:\.\d+)?)\s*(oz|ounces?)/i,
    /(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;

    const value = parseFloat(match[1]);
    if (!Number.isFinite(value) || value < 0) continue;

    const rawUnit = match[2]?.toLowerCase() ?? "lb";
    let unit = "lbs";
    if (rawUnit.startsWith("kg") || rawUnit.startsWith("kilogram")) unit = "kg";
    else if (rawUnit.startsWith("g") && !rawUnit.startsWith("lb")) unit = "g";
    else if (rawUnit.startsWith("oz") || rawUnit.startsWith("ounce")) unit = "oz";

    return { value, unit };
  }

  return null;
}

export function scaleValueToInventoryUnit(
  value: number,
  scaleUnit: string,
  inventoryUnit: string
): number {
  return convertQuantity(value, scaleUnit, inventoryUnit);
}

/** @deprecated use scaleValueToInventoryUnit */
export function gramsToInventoryUnit(value: number, unit: string): number {
  if (unit === "g" || unit === "grams") return convertQuantity(value, "g", "lbs");
  return value;
}
