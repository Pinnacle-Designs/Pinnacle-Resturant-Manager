import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { syncOfflineLines } from "@/lib/walk-in/count-session";
import { syncMonthlyOfflineLines } from "@/lib/walk-in/monthly-count";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_inventory");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const sessionId = body.sessionId as string;
  const lines = body.lines as {
    inventoryItemId: string;
    countedQty: number;
    countUnit?: string;
    weighedGrams?: number;
    notes?: string;
    clientId?: string;
    zoneId?: string;
    locationLabel?: string;
    partialFill?: number;
    unitBreakdown?: { unit: string; qty: number }[];
    countedBy?: string;
  }[];

  if (!sessionId || !Array.isArray(lines)) {
    return NextResponse.json({ error: "sessionId and lines required" }, { status: 400 });
  }

  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, locationId },
  });

  const results =
    session?.sessionType === "MONTHLY"
      ? await syncMonthlyOfflineLines(locationId, sessionId, lines)
      : await syncOfflineLines(locationId, sessionId, lines);

  return NextResponse.json({ synced: results.length, results });
}
