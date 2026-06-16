/** Convert between weight/volume/count units for inventory. */

const TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

const TO_ML: Record<string, number> = {
  ml: 1,
  cup: 236.588,
  cups: 236.588,
  tbsp: 14.787,
  tsp: 4.929,
  liter: 1000,
  liters: 1000,
  gal: 3785.41,
  gallon: 3785.41,
};

export interface AlternateUnit {
  unit: string;
  factor: number;
  label?: string;
}

export function parseAlternateUnits(json: string | null | undefined): AlternateUnit[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function gramsToUnit(grams: number, targetUnit: string): number {
  const u = targetUnit.toLowerCase();
  const factor = TO_GRAMS[u];
  if (factor) return grams / factor;
  const mlFactor = TO_ML[u];
  if (mlFactor) return grams / mlFactor;
  return grams;
}

export function convertQuantity(
  value: number,
  fromUnit: string,
  toUnit: string,
  alternates?: AlternateUnit[]
): number {
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();
  if (from === to) return value;

  const fromGrams = TO_GRAMS[from];
  const toGrams = TO_GRAMS[to];
  if (fromGrams && toGrams) {
    return (value * fromGrams) / toGrams;
  }

  const fromMl = TO_ML[from];
  const toMl = TO_ML[to];
  if (fromMl && toMl) {
    return (value * fromMl) / toMl;
  }

  for (const alt of alternates ?? []) {
    if (alt.unit.toLowerCase() === from && to === "base") {
      return value * alt.factor;
    }
    if (alt.unit.toLowerCase() === to && from === "base") {
      return value / alt.factor;
    }
  }

  for (const alt of alternates ?? []) {
    if (alt.unit.toLowerCase() === from) {
      const baseVal = value * alt.factor;
      if (toGrams) return baseVal / toGrams;
      if (toMl) return baseVal / toMl;
      if (to === alt.unit.toLowerCase()) return value;
    }
    if (alt.unit.toLowerCase() === to) {
      const baseVal = value / alt.factor;
      if (fromGrams) return baseVal * fromGrams;
      if (fromMl) return baseVal * fromMl;
    }
  }

  return value;
}

export function scaleReadingToInventoryUnit(
  value: number,
  scaleUnit: string,
  inventoryUnit: string,
  alternates?: AlternateUnit[]
): number {
  return convertQuantity(value, scaleUnit, inventoryUnit, alternates);
}

export function formatConversionHint(
  value: number,
  inventoryUnit: string,
  alternates: AlternateUnit[]
): string[] {
  const hints: string[] = [];
  for (const alt of alternates) {
    const converted = convertQuantity(value, inventoryUnit, alt.unit, alternates);
    if (Number.isFinite(converted)) {
      hints.push(`${converted.toFixed(2)} ${alt.label ?? alt.unit}`);
    }
  }
  return hints;
}

/** Default alternates for common restaurant units */
export function defaultAlternatesForUnit(baseUnit: string): AlternateUnit[] {
  const u = baseUnit.toLowerCase();
  if (u === "lbs" || u === "lb") {
    return [
      { unit: "bag", factor: 50, label: "50lb bag" },
      { unit: "oz", factor: 1 / 16, label: "oz" },
      { unit: "cup", factor: 0.5, label: "cups (approx)" },
    ];
  }
  if (u === "each" || u === "units") {
    return [{ unit: "case", factor: 24, label: "case (24)" }];
  }
  if (u === "bottles") {
    return [{ unit: "case", factor: 12, label: "case (12)" }];
  }
  return [];
}
