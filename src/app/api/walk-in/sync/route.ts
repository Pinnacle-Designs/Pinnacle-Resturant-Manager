import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { syncOfflineLines } from "@/lib/walk-in/count-session";

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
  }[];

  if (!sessionId || !Array.isArray(lines)) {
    return NextResponse.json({ error: "sessionId and lines required" }, { status: 400 });
  }

  const results = await syncOfflineLines(locationId, sessionId, lines);
  return NextResponse.json({ synced: results.length, results });
}
