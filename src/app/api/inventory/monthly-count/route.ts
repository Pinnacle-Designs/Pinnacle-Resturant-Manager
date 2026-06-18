import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { ensureInventoryStorageLayout } from "@/lib/walk-in/assign-inventory-zones";
import {
  startMonthlyCountSession,
  computeMonthlyCogs,
  getZoneAssignments,
} from "@/lib/walk-in/monthly-count";
import { startOfMonth } from "date-fns";
import { parseAlternateUnits, defaultAlternatesForUnit } from "@/lib/walk-in/unit-convert";
import { getSessionUserFromRequest } from "@/lib/auth";
import { resolveStaffMemberForUser } from "@/lib/staff-resolve";

export async function GET(request: NextRequest) {
  try {
    const { error } = await requirePermission(request, "manage_inventory");
    if (error) return error;

    const locationId = await getLocationIdFromRequest(request);
    await ensureInventoryStorageLayout(locationId);

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period");
    const includeReport = searchParams.get("report") === "1";
    const periodMonth = periodParam
      ? startOfMonth(new Date(periodParam))
      : startOfMonth(new Date());

    const [zones, activeSession, history, items, staff] = await Promise.all([
      prisma.storageZone.findMany({
        where: { locationId },
        include: {
          routeSteps: {
            include: { inventoryItem: true },
            orderBy: { sortOrder: "asc" },
          },
          _count: { select: { items: true } },
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.inventoryCountSession.findFirst({
        where: {
          locationId,
          sessionType: "MONTHLY",
          status: "IN_PROGRESS",
        },
        include: {
          lines: {
            include: { inventoryItem: true, zone: true },
            orderBy: { countedAt: "desc" },
          },
        },
      }),
      prisma.inventoryCountSession.findMany({
        where: { locationId, sessionType: "MONTHLY", status: "FINALIZED" },
        orderBy: { periodMonth: "desc" },
        take: 12,
      }),
      prisma.inventoryItem.findMany({
        where: { locationId },
        select: {
          id: true,
          name: true,
          barcode: true,
          quantity: true,
          unit: true,
          alternateUnits: true,
          costPerUnit: true,
          storageZoneId: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.staffMember.findMany({
        where: { locationId, active: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const user = await getSessionUserFromRequest(request);
    const currentStaff = user ? await resolveStaffMemberForUser(user, locationId) : null;

    let zoneAssignments: Awaited<ReturnType<typeof getZoneAssignments>> = [];
    if (activeSession) {
      zoneAssignments = await getZoneAssignments(activeSession.id);
    }

    let report = null;
    if (includeReport) {
      const finalized = history.find(
        (s) => s.periodMonth?.getTime() === periodMonth.getTime()
      );
      if (finalized) {
        report = await computeMonthlyCogs(locationId, periodMonth);
      }
    }

    const catalogItems = items.map((item) => ({
      ...item,
      alternates: [
        ...parseAlternateUnits(item.alternateUnits),
        ...defaultAlternatesForUnit(item.unit),
      ],
      isLiquor: item.unit.toLowerCase() === "bottles",
    }));

    return NextResponse.json({
      zones,
      activeSession,
      history,
      periodMonth: periodMonth.toISOString(),
      report,
      catalogItems,
      staff,
      zoneAssignments,
      currentStaff: currentStaff
        ? { id: currentStaff.id, name: currentStaff.name, role: currentStaff.role }
        : null,
    });
  } catch (err) {
    console.error("[monthly-count GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load monthly count" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requirePermission(request, "manage_inventory");
    if (error) return error;

    const locationId = await getLocationIdFromRequest(request);
    let body: { periodMonth?: string; startedBy?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const periodMonth = body.periodMonth
      ? startOfMonth(new Date(body.periodMonth))
      : startOfMonth(new Date());

    const session = await startMonthlyCountSession(
      locationId,
      periodMonth,
      body.startedBy
    );

    return NextResponse.json({ session: { ...session, lines: [] } });
  } catch (err) {
    console.error("[monthly-count POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start monthly count" },
      { status: 500 }
    );
  }
}
