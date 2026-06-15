import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { loadPayrollPreview } from "@/lib/payroll/load-context";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_payroll");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const startParam = request.nextUrl.searchParams.get("periodStart");
  const endParam = request.nextUrl.searchParams.get("periodEnd");

  if (!startParam || !endParam) {
    return NextResponse.json(
      { error: "periodStart and periodEnd are required" },
      { status: 400 }
    );
  }

  const periodStart = new Date(startParam);
  const periodEnd = new Date(endParam);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return NextResponse.json({ error: "Invalid period dates" }, { status: 400 });
  }

  const preview = await loadPayrollPreview(locationId, periodStart, periodEnd);
  return NextResponse.json(preview);
}
