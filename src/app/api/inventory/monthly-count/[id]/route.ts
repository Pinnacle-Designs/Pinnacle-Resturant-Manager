import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import {
  addMonthlyCountLine,
  finalizeMonthlyCount,
  aggregateSessionCounts,
  computeMonthlyCogs,
  detectAnomaly,
  setZoneAssignments,
  getZoneAssignments,
} from "@/lib/walk-in/monthly-count";

async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid request body");
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission(request, "manage_inventory");
    if (error) return error;

    const { id } = await params;
    const locationId = await getLocationIdFromRequest(request);

    const session = await prisma.inventoryCountSession.findFirst({
      where: { id, locationId, sessionType: "MONTHLY" },
      include: {
        lines: {
          include: { inventoryItem: true, zone: true },
          orderBy: { countedAt: "desc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const aggregated = await aggregateSessionCounts(id);
    const zoneAssignments = await getZoneAssignments(id);
    const report =
      session.status === "FINALIZED" && session.periodMonth
        ? await computeMonthlyCogs(locationId, session.periodMonth)
        : null;

    return NextResponse.json({ session, aggregated, report, zoneAssignments });
  } catch (err) {
    console.error("[monthly-count GET id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load session" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission(request, "manage_inventory");
    if (error) return error;

    const { id } = await params;
    const locationId = await getLocationIdFromRequest(request);
    const body = await readJsonBody(request);

    if (body.action === "finalize") {
      const result = await finalizeMonthlyCount(id, locationId);
      return NextResponse.json(result);
    }

    if (body.action === "assign-zones") {
      const assignments = body.assignments as { zoneId: string; staffMemberId: string | null }[];
      if (!Array.isArray(assignments)) {
        return NextResponse.json({ error: "assignments array required" }, { status: 400 });
      }
      const updated = await setZoneAssignments(id, locationId, assignments);
      return NextResponse.json({ assignments: updated });
    }

    if (body.action === "check-anomaly") {
      const warning = await detectAnomaly(
        locationId,
        String(body.inventoryItemId),
        parseFloat(String(body.countedQty)),
        body.locationLabel ? String(body.locationLabel) : undefined
      );
      return NextResponse.json({ warning });
    }

    const result = await addMonthlyCountLine(id, locationId, {
      inventoryItemId: String(body.inventoryItemId),
      countedQty: parseFloat(String(body.countedQty)) || 0,
      countUnit: body.countUnit ? String(body.countUnit) : undefined,
      weighedGrams: body.weighedGrams ? parseFloat(String(body.weighedGrams)) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      clientId: body.clientId ? String(body.clientId) : undefined,
      zoneId: body.zoneId ? String(body.zoneId) : undefined,
      locationLabel: body.locationLabel ? String(body.locationLabel) : undefined,
      partialFill: body.partialFill != null ? parseFloat(String(body.partialFill)) : undefined,
      unitBreakdown: body.unitBreakdown as { unit: string; qty: number }[] | undefined,
      countedBy: body.countedBy ? String(body.countedBy) : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[monthly-count POST id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
