import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { computeLogBookDaySnapshot } from "@/lib/log-book/snapshots";
import { startOfBusinessDay } from "@/lib/log-book/utils";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "view_log_book");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const dateParam = request.nextUrl.searchParams.get("date");
  const logDate = dateParam ? startOfBusinessDay(new Date(dateParam)) : startOfBusinessDay(new Date());

  const snapshot = await computeLogBookDaySnapshot(locationId, logDate);
  return NextResponse.json({ date: logDate.toISOString(), ...snapshot });
}
