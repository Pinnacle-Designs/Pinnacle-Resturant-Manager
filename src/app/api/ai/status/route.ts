import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getLocationId } from "@/lib/location";
import { buildCommandCenterSnapshot, buildLiveSignals } from "@/lib/ai/command-center";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "view_insights");
  if (error) return error;

  try {
    const locationId = await getLocationId();
    const snapshot = await buildCommandCenterSnapshot(locationId);
    const signals = buildLiveSignals(snapshot);

    const alertCount = snapshot.alerts.length;
    const findingCount = signals.filter((s) => s.status !== "green").length;

    return NextResponse.json({
      locationName: snapshot.locationName,
      scannedAt: snapshot.scannedAt,
      signals,
      summary: {
        netSales: snapshot.sales.netSales,
        profit: snapshot.profitability.netProfit,
        marginPct: snapshot.profitability.marginPct,
        primeCostPct: snapshot.profitability.primeCostPct,
        alertCount,
        watchCount: findingCount,
      },
    });
  } catch (err) {
    console.error("Command center status error:", err);
    return NextResponse.json({ error: "Failed to load status" }, { status: 500 });
  }
}
