/** Convert between weight/volume/count units for inventory — global standards. */

import type { LocaleMeasurementContext } from "@/lib/location/measurements";
import { defaultWeightUnit } from "@/lib/location/measurements";

const TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  t: 1_000_000,
  tonne: 1_000_000,
  tonnes: 1_000_000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
  ton: 907_184.74,
  tons: 907_184.74,
};

/** All volume units normalized to millilitres */
const TO_ML: Record<string, number> = {
  ml: 1,
  mL: 1,
  cl: 10,
  cL: 10,
  l: 1000,
  L: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  tsp: 4.929,
  tbsp: 14.787,
  cup: 236.588,
  cups: 236.588,
  fl_oz: 29.5735,
  "fl oz": 29.5735,
  pt: 473.176,
  pint: 473.176,
  qt: 946.353,
  quart: 946.353,
  gal: 3785.41,
  gallon: 3785.41,
  fl_oz_uk: 28.4131,
  pt_uk: 568.261,
  qt_uk: 1136.52,
  gal_uk: 4546.09,
  wine_150ml: 150,
  wine_5floz: 147.868,
};

/** Count / specialized units — no cross-dimension conversion */
const COUNT_UNITS = new Set([
  "each",
  "units",
  "unit",
  "dozen",
  "case",
  "cases",
  "heads",
  "head",
  "cloves",
  "clove",
  "portions",
  "portion",
  "wings",
  "wing",
  "oysters",
  "oyster",
  "rolls",
  "roll",
  "bottles",
  "bottle",
  "cans",
  "can",
  "in",
  "gn_1_1",
  "gn_1_2",
  "gn_1_3",
  "gn_1_4",
]);

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

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u === "lb") return "lbs";
  if (u === "liter" || u === "litre") return "L";
  return unit.trim();
}

export function isCountUnit(unit: string): boolean {
  return COUNT_UNITS.has(unit.toLowerCase());
}

export function gramsToUnit(grams: number, targetUnit: string): number {
  const u = normalizeUnit(targetUnit).toLowerCase();
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
  const from = normalizeUnit(fromUnit).toLowerCase();
  const to = normalizeUnit(toUnit).toLowerCase();
  if (from === to) return value;

  if (isCountUnit(from) || isCountUnit(to)) {
    if (from === to) return value;
    return value;
  }

  const fromGrams = TO_GRAMS[from];
  const toGrams = TO_GRAMS[to];
  if (fromGrams && toGrams) {
    return (value * fromGrams) / toGrams;
  }

  const fromMl = TO_ML[from] ?? TO_ML[normalizeUnit(fromUnit)];
  const toMl = TO_ML[to] ?? TO_ML[normalizeUnit(toUnit)];
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

/** Default alternates for common restaurant units — locale-aware */
export function defaultAlternatesForUnit(
  baseUnit: string,
  ctx?: LocaleMeasurementContext
): AlternateUnit[] {
  const u = baseUnit.toLowerCase();
  const imperial = ctx?.measurementSystem === "imperial";

  if (u === "lbs" || u === "lb") {
    return [
      { unit: "bag", factor: 50, label: "50 lb bag" },
      { unit: "oz", factor: 1 / 16, label: "oz" },
      { unit: "kg", factor: 0.453592, label: "kg" },
    ];
  }
  if (u === "kg") {
    return [
      { unit: "g", factor: 0.001, label: "g" },
      ...(imperial || ctx?.measurementSystem === "mixed"
        ? [{ unit: "lbs", factor: 2.20462, label: "lbs" }]
        : []),
      { unit: "case", factor: 10, label: "10 kg case" },
    ];
  }
  if (u === "L" || u === "l") {
    return [
      { unit: "ml", factor: 0.001, label: "mL" },
      { unit: "cl", factor: 0.01, label: "cL" },
      ...(ctx?.volumeStandard === "uk"
        ? [{ unit: "pt_uk", factor: 0.568261, label: "UK pint" }]
        : imperial
          ? [{ unit: "gal", factor: 3.78541, label: "US gal" }]
          : []),
    ];
  }
  if (u === "gal") {
    return [
      { unit: "qt", factor: 0.25, label: "qt" },
      { unit: "L", factor: 3.78541, label: "L" },
    ];
  }
  if (u === "pt_uk") {
    return [
      { unit: "L", factor: 0.568261, label: "L" },
      { unit: "ml", factor: 0.000568261, label: "mL" },
    ];
  }
  if (u === "each" || u === "units") {
    return [
      { unit: "dozen", factor: 12, label: "dozen" },
      { unit: "case", factor: 24, label: "case (24)" },
    ];
  }
  if (u === "bottles") {
    return [{ unit: "case", factor: 12, label: "case (12)" }];
  }
  if (u === "dozen") {
    return [{ unit: "each", factor: 1 / 12, label: "each" }];
  }
  return [];
}

/** Convert scale reading grams to location default weight unit when needed */
export function scaleValueToDefaultWeight(
  value: number,
  scaleUnit: string,
  inventoryUnit: string,
  ctx?: LocaleMeasurementContext
): number {
  const target = inventoryUnit || defaultWeightUnit(ctx ?? { measurementSystem: "imperial", volumeStandard: "us" });
  return convertQuantity(value, scaleUnit, target);
}

export { TO_GRAMS, TO_ML };
