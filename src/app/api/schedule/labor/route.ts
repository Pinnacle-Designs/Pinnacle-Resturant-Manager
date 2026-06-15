import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { getWeekStart } from "@/lib/schedule";
import { computeWeekLaborForecast } from "@/lib/scheduling/labor-forecast";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_schedule");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const weekParam = request.nextUrl.searchParams.get("weekStart");
  const weekStart = weekParam ? new Date(weekParam) : getWeekStart();

  const forecast = await computeWeekLaborForecast(locationId, weekStart);
  return NextResponse.json(forecast);
}
