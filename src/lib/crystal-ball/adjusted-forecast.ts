import { prisma } from "@/lib/prisma";
import { generatePrepList } from "@/lib/kitchen/prep-list";
import { generatePoSuggestions } from "@/lib/purchasing/suggest-orders";
import { computeForecastOverlay } from "./forecast-overlay";

export async function getAdjustedForecast(locationId: string) {
  const [overlay, basePrep, baseSuggestions] = await Promise.all([
    computeForecastOverlay(locationId),
    generatePrepList(locationId),
    generatePoSuggestions(locationId),
  ]);

  const tomorrow = overlay.dailyOverlays[0] ?? overlay.dailyOverlays[1];
  const multiplier = tomorrow?.prepMultiplier ?? 1;

  const adjustedPrep = {
    ...basePrep,
    forecastCovers: Math.round(basePrep.forecastCovers * multiplier),
    tasks: basePrep.tasks.map((t) => ({
      ...t,
      rawQtyNeeded: Math.round(t.rawQtyNeeded * multiplier * 10) / 10,
      prepQty: Math.round(t.prepQty * multiplier * 10) / 10,
      overlayNote: tomorrow?.drivers[0],
    })),
    summary: `${basePrep.summary} · Weather/event overlay ×${multiplier}`,
    overlay: tomorrow,
  };

  const adjustedPar = baseSuggestions.map((s) => ({
    ...s,
    suggestedQty: Math.ceil(s.suggestedQty * (tomorrow?.parMultiplier ?? 1)),
    lineTotal: Math.round(s.unitPrice * Math.ceil(s.suggestedQty * (tomorrow?.parMultiplier ?? 1)) * 100) / 100,
    reason: `${s.reason}${tomorrow ? ` · Crystal Ball: ${tomorrow.condition}` : ""}`,
  }));

  return { adjustedPrep, adjustedPar, overlay };
}
