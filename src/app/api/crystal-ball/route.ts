import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { computeForecastOverlay } from "@/lib/crystal-ball/forecast-overlay";
import { detectMicroTrends } from "@/lib/crystal-ball/micro-trends";
import { getAdjustedForecast } from "@/lib/crystal-ball/adjusted-forecast";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "view_analytics");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);

  const [overlay, microTrends, adjusted] = await Promise.all([
    computeForecastOverlay(locationId),
    detectMicroTrends(locationId),
    getAdjustedForecast(locationId),
  ]);

  return NextResponse.json({
    overlay,
    microTrends,
    adjustedPrep: adjusted.adjustedPrep,
    adjustedPar: adjusted.adjustedPar,
  });
}
