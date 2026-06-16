import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { generatePrepList } from "@/lib/kitchen/prep-list";

function parseTargetDate(searchParams: URLSearchParams): Date {
  const raw = searchParams.get("date");
  if (!raw) return new Date();
  const parsed = new Date(raw + "T12:00:00");
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_menu");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const targetDate = parseTargetDate(request.nextUrl.searchParams);
  const prepList = await generatePrepList(locationId, targetDate);

  return NextResponse.json({ prepList });
}
