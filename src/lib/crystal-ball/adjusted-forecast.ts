import { generatePrepList, scalePrepList } from "@/lib/kitchen/prep-list";
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

  const adjustedPrep = scalePrepList(
    basePrep,
    multiplier,
    tomorrow ? `Crystal Ball overlay ×${multiplier} (${tomorrow.drivers[0] ?? tomorrow.condition})` : undefined
  );

  const adjustedPar = baseSuggestions.map((s) => ({
    ...s,
    suggestedQty: Math.ceil(s.suggestedQty * (tomorrow?.parMultiplier ?? 1)),
    lineTotal:
      Math.round(
        s.unitPrice * Math.ceil(s.suggestedQty * (tomorrow?.parMultiplier ?? 1)) * 100
      ) / 100,
    reason: `${s.reason}${tomorrow ? ` · Crystal Ball: ${tomorrow.condition}` : ""}`,
  }));

  return { adjustedPrep, adjustedPar, overlay };
}
