import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { getComplianceAlerts } from "@/lib/compliance/compliance-alerts";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_schedule");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const alerts = await getComplianceAlerts(locationId);
  return NextResponse.json(alerts);
}
