import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { computeAnalytics } from "@/lib/analytics/compute";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "view_analytics");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const data = await computeAnalytics(locationId);
  return NextResponse.json(data);
}
