/**
 * Global restaurant measurement standards — metric (SI), US imperial, UK/Commonwealth mixed.
 * Count and gastronorm (GN) units are universal; volume differs by US vs UK imperial.
 */

export type MeasurementSystem = "imperial" | "metric" | "mixed";
export type VolumeStandard = "us" | "uk" | "metric";
export type UnitCategory = "weight" | "volume" | "count" | "temperature" | "specialized";

export interface UnitDefinition {
  id: string;
  label: string;
  category: UnitCategory;
  /** Empty = available in all systems */
  systems?: MeasurementSystem[];
  /** For volume units — which gallon/pint standard applies */
  volumeStandards?: VolumeStandard[];
}

/** Canonical unit catalog for restaurant inventory & recipes */
export const RESTAURANT_UNITS: UnitDefinition[] = [
  // Weight — metric (SI)
  { id: "g", label: "Grams (g)", category: "weight", systems: ["metric", "mixed"] },
  { id: "kg", label: "Kilograms (kg)", category: "weight", systems: ["metric", "mixed"] },
  { id: "t", label: "Tonnes (t)", category: "weight", systems: ["metric", "mixed"] },
  // Weight — imperial
  { id: "oz", label: "Ounces (oz)", category: "weight", systems: ["imperial", "mixed"] },
  { id: "lbs", label: "Pounds (lb)", category: "weight", systems: ["imperial", "mixed"] },
  { id: "ton", label: "Tons (US)", category: "weight", systems: ["imperial"] },
  // Volume — metric
  { id: "ml", label: "Millilitres (mL)", category: "volume", systems: ["metric", "mixed"], volumeStandards: ["metric", "uk"] },
  { id: "cl", label: "Centilitres (cL)", category: "volume", systems: ["metric", "mixed"], volumeStandards: ["metric", "uk"] },
  { id: "L", label: "Litres (L)", category: "volume", systems: ["metric", "mixed"], volumeStandards: ["metric", "uk"] },
  // Volume — US customary
  { id: "tsp", label: "Teaspoons (tsp)", category: "volume", systems: ["imperial", "mixed"], volumeStandards: ["us", "metric"] },
  { id: "tbsp", label: "Tablespoons (Tbsp)", category: "volume", systems: ["imperial", "mixed"], volumeStandards: ["us", "metric"] },
  { id: "fl_oz", label: "Fluid ounces (US fl oz)", category: "volume", systems: ["imperial", "mixed"], volumeStandards: ["us"] },
  { id: "cup", label: "Cups (US)", category: "volume", systems: ["imperial", "mixed"], volumeStandards: ["us", "metric"] },
  { id: "pt", label: "Pints (US)", category: "volume", systems: ["imperial", "mixed"], volumeStandards: ["us"] },
  { id: "qt", label: "Quarts (US)", category: "volume", systems: ["imperial"], volumeStandards: ["us"] },
  { id: "gal", label: "Gallons (US)", category: "volume", systems: ["imperial"], volumeStandards: ["us"] },
  // Volume — UK / Commonwealth imperial
  { id: "fl_oz_uk", label: "Fluid ounces (UK)", category: "volume", systems: ["mixed"], volumeStandards: ["uk"] },
  { id: "pt_uk", label: "Pints (UK — draft beer)", category: "volume", systems: ["mixed"], volumeStandards: ["uk"] },
  { id: "qt_uk", label: "Quarts (UK)", category: "volume", systems: ["mixed"], volumeStandards: ["uk"] },
  { id: "gal_uk", label: "Gallons (UK imperial)", category: "volume", systems: ["mixed"], volumeStandards: ["uk"] },
  // Count — universal
  { id: "each", label: "Each", category: "count" },
  { id: "units", label: "Units / pieces", category: "count" },
  { id: "dozen", label: "Dozen (12)", category: "count" },
  { id: "case", label: "Case", category: "count" },
  { id: "heads", label: "Heads (produce)", category: "count" },
  { id: "cloves", label: "Cloves (garlic)", category: "count" },
  { id: "portions", label: "Portions", category: "count" },
  { id: "wings", label: "Wings", category: "count" },
  { id: "oysters", label: "Oysters", category: "count" },
  { id: "rolls", label: "Rolls (sushi etc.)", category: "count" },
  { id: "bottles", label: "Bottles", category: "count" },
  { id: "cans", label: "Cans", category: "count" },
  // Specialized — global restaurant standards
  { id: "in", label: "Inches (pizza diameter)", category: "specialized" },
  { id: "gn_1_1", label: "GN 1/1 pan", category: "specialized" },
  { id: "gn_1_2", label: "GN 1/2 pan", category: "specialized" },
  { id: "gn_1_3", label: "GN 1/3 pan", category: "specialized" },
  { id: "gn_1_4", label: "GN 1/4 pan", category: "specialized" },
  { id: "wine_150ml", label: "Wine pour (150 mL)", category: "specialized", systems: ["metric", "mixed"], volumeStandards: ["metric", "uk"] },
  { id: "wine_5floz", label: "Wine pour (5 fl oz)", category: "specialized", systems: ["imperial", "mixed"], volumeStandards: ["us"] },
];

/** Countries using US customary (lbs, °F, US gallons) — primarily US, Liberia, Myanmar */
export const IMPERIAL_COUNTRIES = new Set(["US", "LR", "MM"]);

/** UK & crown dependencies — metric weight, UK pints for draft, °C */
export const UK_MIXED_COUNTRIES = new Set(["GB", "IM", "GG", "JE"]);

/** Commonwealth countries with legal/metric primary but common imperial usage in trade */
export const COMMONWEALTH_MIXED_COUNTRIES = new Set(["CA"]);

export interface MeasurementProfile {
  measurementSystem: MeasurementSystem;
  volumeStandard: VolumeStandard;
}

export function resolveMeasurementProfile(countryCode?: string | null): MeasurementProfile {
  const cc = (countryCode ?? "US").trim().toUpperCase();
  if (IMPERIAL_COUNTRIES.has(cc)) {
    return { measurementSystem: "imperial", volumeStandard: "us" };
  }
  if (UK_MIXED_COUNTRIES.has(cc)) {
    return { measurementSystem: "mixed", volumeStandard: "uk" };
  }
  if (COMMONWEALTH_MIXED_COUNTRIES.has(cc)) {
    return { measurementSystem: "mixed", volumeStandard: "metric" };
  }
  return { measurementSystem: "metric", volumeStandard: "metric" };
}

export interface LocaleMeasurementContext {
  measurementSystem: MeasurementSystem;
  volumeStandard: VolumeStandard;
}

function unitAvailable(def: UnitDefinition, ctx: LocaleMeasurementContext): boolean {
  if (def.systems?.length && !def.systems.includes(ctx.measurementSystem)) return false;
  if (def.volumeStandards?.length && !def.volumeStandards.includes(ctx.volumeStandard)) {
    if (ctx.measurementSystem === "mixed" && def.category === "volume") {
      return def.volumeStandards.includes("metric") || def.volumeStandards.includes(ctx.volumeStandard);
    }
    if (def.category !== "volume") return true;
    return false;
  }
  return true;
}

export function getUnitsForCategory(
  ctx: LocaleMeasurementContext,
  category: UnitCategory
): UnitDefinition[] {
  return RESTAURANT_UNITS.filter((u) => u.category === category && unitAvailable(u, ctx));
}

export function getInventoryUnitOptions(ctx: LocaleMeasurementContext): Array<{
  value: string;
  label: string;
  group: string;
}> {
  const groups: Record<UnitCategory, string> = {
    weight: "Weight",
    volume: "Volume",
    count: "Count",
    temperature: "Temperature",
    specialized: "Kitchen & beverage",
  };

  const categories: UnitCategory[] = ["weight", "volume", "count", "specialized"];
  const options: Array<{ value: string; label: string; group: string }> = [];

  for (const cat of categories) {
    for (const def of getUnitsForCategory(ctx, cat)) {
      options.push({ value: def.id, label: def.label, group: groups[cat] });
    }
  }
  return options;
}

export function defaultWeightUnit(ctx: LocaleMeasurementContext): string {
  return ctx.measurementSystem === "imperial" ? "lbs" : "kg";
}

export function defaultVolumeUnit(ctx: LocaleMeasurementContext): string {
  if (ctx.measurementSystem === "imperial") return "gal";
  if (ctx.volumeStandard === "uk") return "L";
  return "L";
}

export function defaultLiquidUnit(ctx: LocaleMeasurementContext): string {
  if (ctx.measurementSystem === "imperial") return "fl_oz";
  if (ctx.volumeStandard === "uk") return "pt_uk";
  return "ml";
}

export function defaultCountUnit(): string {
  return "each";
}

export function temperatureUnit(ctx: LocaleMeasurementContext): "fahrenheit" | "celsius" {
  return ctx.measurementSystem === "imperial" ? "fahrenheit" : "celsius";
}

export function usesMetricTemperature(ctx: LocaleMeasurementContext): boolean {
  return ctx.measurementSystem !== "imperial";
}

export function barcodeAiUnitList(ctx: LocaleMeasurementContext): string {
  const ids = getInventoryUnitOptions(ctx).map((o) => o.value);
  return [...new Set(ids)].join(", ");
}

export function measurementSystemLabel(ctx: LocaleMeasurementContext): string {
  if (ctx.measurementSystem === "imperial") {
    return "US Imperial (lb, gal, °F)";
  }
  if (ctx.measurementSystem === "mixed" && ctx.volumeStandard === "uk") {
    return "UK Mixed (kg, UK pint, °C)";
  }
  if (ctx.measurementSystem === "mixed") {
    return "Mixed (kg + US/CA customary)";
  }
  return "Metric / SI (kg, L, °C)";
}

export const UNIT_CATEGORY_LABELS: Record<UnitCategory, string> = {
  weight: "Weight — g, kg, t / oz, lb",
  volume: "Volume — mL, L / tsp, cup, gal",
  count: "Count — each, dozen, case, portions",
  temperature: "Temperature — °C / °F",
  specialized: "GN pans, pizza (in), wine pours",
};
