import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { computeForecastOverlay } from "@/lib/crystal-ball/forecast-overlay";
import { detectMicroTrends } from "@/lib/crystal-ball/micro-trends";
import { getAdjustedForecast } from "@/lib/crystal-ball/adjusted-forecast";
import { syncExternalFactorsForLocation } from "@/lib/external/sync-weather";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "view_analytics");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const location = await prisma.location.findUnique({ where: { id: locationId } });

  if (location) {
    await Promise.race([
      syncExternalFactorsForLocation(locationId, location),
      new Promise((_, reject) => setTimeout(() => reject(new Error("sync timeout")), 10_000)),
    ]).catch((err) => console.warn("Crystal Ball sync skipped:", err));
  }

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
