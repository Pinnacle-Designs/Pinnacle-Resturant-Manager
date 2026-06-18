import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import { convertQuantity, parseAlternateUnits } from "./unit-convert";
import { rawQuantityForSellable } from "@/lib/menu/recipe";

export interface UnitBreakdownEntry {
  unit: string;
  qty: number;
}

export interface CountLineInput {
  inventoryItemId: string;
  countedQty: number;
  countUnit?: string;
  weighedGrams?: number;
  notes?: string;
  clientId?: string;
  zoneId?: string;
  locationLabel?: string;
  partialFill?: number;
  unitBreakdown?: UnitBreakdownEntry[];
  countedBy?: string;
}

export interface AnomalyWarning {
  inventoryItemId: string;
  itemName: string;
  locationLabel?: string;
  countedQty: number;
  averageQty: number;
  deviationPct: number;
  message: string;
}

export interface MonthlyVarianceLine {
  inventoryItemId: string;
  name: string;
  unit: string;
  openingQty: number;
  purchasesQty: number;
  theoreticalQty: number;
  actualQty: number;
  varianceQty: number;
  variancePct: number;
  varianceCost: number;
  costPerUnit: number;
  flag: "OK" | "OVER" | "UNDER";
}

export interface MonthlyCountReport {
  periodMonth: string;
  totalInventoryValue: number;
  openingValue: number;
  purchasesValue: number;
  cogsAmount: number;
  cogsPct: number;
  revenue: number;
  varianceLines: MonthlyVarianceLine[];
  aggregatedCounts: { inventoryItemId: string; name: string; totalQty: number; unit: string; locations: string[] }[];
  summary: string;
}

function locationKey(zoneId?: string | null, locationLabel?: string | null): string {
  return `${zoneId ?? ""}::${locationLabel ?? ""}`;
}

/** Sum multi-unit breakdown (cases + sleeves + each) into base inventory unit. */
export function sumUnitBreakdown(
  entries: UnitBreakdownEntry[],
  baseUnit: string,
  alternates: ReturnType<typeof parseAlternateUnits>
): number {
  let total = 0;
  for (const entry of entries) {
    if (!entry.qty || entry.qty <= 0) continue;
    total += convertQuantity(entry.qty, entry.unit, baseUnit, alternates);
  }
  return total;
}

/** Resolve counted quantity from direct input, partial fill, or multi-unit breakdown. */
export function resolveCountedQty(
  input: CountLineInput,
  itemUnit: string,
  alternates: ReturnType<typeof parseAlternateUnits>
): number {
  if (input.unitBreakdown && input.unitBreakdown.length > 0) {
    return sumUnitBreakdown(input.unitBreakdown, itemUnit, alternates);
  }
  let qty = input.countedQty;
  if (input.partialFill != null && input.partialFill >= 0 && input.partialFill <= 1) {
    qty = input.partialFill;
  }
  const countUnit = input.countUnit ?? itemUnit;
  if (countUnit !== itemUnit) {
    qty = convertQuantity(qty, countUnit, itemUnit, alternates);
  }
  return qty;
}

export async function getLatestInvoicePrice(
  locationId: string,
  inventoryItemId: string
): Promise<number> {
  const line = await prisma.vendorInvoiceLine.findFirst({
    where: {
      inventoryItemId,
      invoice: { locationId },
    },
    orderBy: { invoice: { invoiceDate: "desc" } },
    include: { invoice: true },
  });
  if (line?.unitPrice && ["MATCHED", "APPROVED", "PAID"].includes(line.invoice.matchStatus)) {
    return line.unitPrice;
  }

  const receiptLine = await prisma.goodsReceiptLine.findFirst({
    where: { inventoryItemId, receipt: { locationId } },
    orderBy: { receipt: { receivedAt: "desc" } },
  });
  if (receiptLine?.unitCost) return receiptLine.unitCost;

  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  return item?.costPerUnit ?? 0;
}

export async function detectAnomaly(
  locationId: string,
  inventoryItemId: string,
  countedQty: number,
  locationLabel?: string
): Promise<AnomalyWarning | null> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: inventoryItemId, locationId },
  });
  if (!item) return null;

  const since = subMonths(new Date(), 6);
  const historical = await prisma.inventoryCountLine.findMany({
    where: {
      inventoryItemId,
      session: {
        locationId,
        sessionType: "MONTHLY",
        status: "FINALIZED",
        finalizedAt: { gte: since },
      },
      ...(locationLabel ? { locationLabel } : {}),
    },
    select: { countedQty: true },
    take: 12,
  });

  const bookQty = item.quantity;
  let averageQty: number;
  if (historical.length >= 2) {
    averageQty = historical.reduce((s, h) => s + h.countedQty, 0) / historical.length;
  } else if (bookQty > 0) {
    averageQty = bookQty;
  } else {
    return null;
  }

  if (averageQty <= 0) return null;

  const deviationPct = ((countedQty - averageQty) / averageQty) * 100;
  const absDev = Math.abs(deviationPct);

  if (absDev < 75) return null;

  const direction = deviationPct > 0 ? "higher" : "lower";
  return {
    inventoryItemId,
    itemName: item.name,
    locationLabel,
    countedQty,
    averageQty: Math.round(averageQty * 100) / 100,
    deviationPct: Math.round(deviationPct),
    message: `Warning: This count is ${Math.round(absDev)}% ${direction} than your average (${averageQty.toFixed(1)} ${item.unit}). Please verify.`,
  };
}

export async function startMonthlyCountSession(
  locationId: string,
  periodMonth: Date,
  startedBy?: string
) {
  const monthStart = startOfMonth(periodMonth);

  const existing = await prisma.inventoryCountSession.findFirst({
    where: {
      locationId,
      sessionType: "MONTHLY",
      periodMonth: monthStart,
      status: "IN_PROGRESS",
    },
  });
  if (existing) return existing;

  return prisma.inventoryCountSession.create({
    data: {
      locationId,
      sessionType: "MONTHLY",
      periodMonth: monthStart,
      startedBy: startedBy ?? null,
      status: "IN_PROGRESS",
    },
  });
}

export async function addMonthlyCountLine(
  sessionId: string,
  locationId: string,
  input: CountLineInput
) {
  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, locationId, status: "IN_PROGRESS", sessionType: "MONTHLY" },
  });
  if (!session) throw new Error("Monthly count session not found or already finalized");

  const item = await prisma.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, locationId },
  });
  if (!item) throw new Error("Inventory item not found");

  const alternates = parseAlternateUnits(item.alternateUnits);
  const countedQty = resolveCountedQty(input, item.unit, alternates);
  const bookQty = item.quantity;
  const variance = countedQty - bookQty;

  const locKey = locationKey(input.zoneId, input.locationLabel);
  const existingLines = await prisma.inventoryCountLine.findMany({
    where: { sessionId, inventoryItemId: input.inventoryItemId },
    include: { zone: true },
  });
  const existing = existingLines.find(
    (l) => locationKey(l.zoneId, l.locationLabel) === locKey
  );

  const lineData = {
    countedQty,
    countUnit: input.countUnit ?? item.unit,
    weighedGrams: input.weighedGrams ?? null,
    partialFill: input.partialFill ?? null,
    unitBreakdown: input.unitBreakdown ? JSON.stringify(input.unitBreakdown) : null,
    variance,
    notes: input.notes ?? null,
    zoneId: input.zoneId ?? null,
    locationLabel: input.locationLabel ?? null,
    countedBy: input.countedBy ?? null,
    countedAt: new Date(),
  };

  const line = existing
    ? await prisma.inventoryCountLine.update({
        where: { id: existing.id },
        data: lineData,
        include: { inventoryItem: true, zone: true },
      })
    : await prisma.inventoryCountLine.create({
        data: {
          sessionId,
          inventoryItemId: input.inventoryItemId,
          bookQty,
          unit: item.unit,
          clientId: input.clientId ?? null,
          ...lineData,
        },
        include: { inventoryItem: true, zone: true },
      });

  const anomaly = await detectAnomaly(
    locationId,
    input.inventoryItemId,
    countedQty,
    input.locationLabel ?? undefined
  );

  return { line, item, bookQty, countedQty, variance, anomaly };
}

export async function aggregateSessionCounts(sessionId: string) {
  const lines = await prisma.inventoryCountLine.findMany({
    where: { sessionId },
    include: { inventoryItem: true, zone: true },
  });

  const byItem = new Map<
    string,
    { name: string; unit: string; totalQty: number; locations: string[] }
  >();

  for (const line of lines) {
    const key = line.inventoryItemId;
    const loc =
      line.locationLabel ??
      line.zone?.name ??
      "Unassigned";
    const prev = byItem.get(key);
    if (prev) {
      prev.totalQty += line.countedQty;
      if (!prev.locations.includes(loc)) prev.locations.push(loc);
    } else {
      byItem.set(key, {
        name: line.inventoryItem.name,
        unit: line.inventoryItem.unit,
        totalQty: line.countedQty,
        locations: [loc],
      });
    }
  }

  return Array.from(byItem.entries()).map(([inventoryItemId, data]) => ({
    inventoryItemId,
    ...data,
    totalQty: Math.round(data.totalQty * 1000) / 1000,
  }));
}

export async function computeMonthlyVariance(
  locationId: string,
  periodMonth: Date
): Promise<MonthlyVarianceLine[]> {
  const monthStart = startOfMonth(periodMonth);
  const monthEnd = endOfMonth(periodMonth);

  const [inventory, orders, receipts, session] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { locationId } }),
    prisma.order.findMany({
      where: {
        locationId,
        status: { in: ["PAID", "SERVED", "READY"] },
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      include: {
        items: {
          include: {
            menuItem: { include: { recipeLines: { include: { inventoryItem: true } } } },
          },
        },
      },
    }),
    prisma.goodsReceiptLine.findMany({
      where: {
        receipt: { locationId, receivedAt: { gte: monthStart, lte: monthEnd } },
      },
    }),
    prisma.inventoryCountSession.findFirst({
      where: {
        locationId,
        sessionType: "MONTHLY",
        periodMonth: monthStart,
      },
      include: { lines: true },
    }),
  ]);

  const priorSession = await prisma.inventoryCountSession.findFirst({
    where: {
      locationId,
      sessionType: "MONTHLY",
      periodMonth: startOfMonth(subMonths(monthStart, 1)),
      status: "FINALIZED",
    },
    include: { lines: true },
  });

  const openingByItem = new Map<string, number>();
  if (priorSession) {
    const agg = await aggregateSessionCounts(priorSession.id);
    for (const a of agg) openingByItem.set(a.inventoryItemId, a.totalQty);
  } else {
    for (const item of inventory) openingByItem.set(item.id, item.quantity);
  }

  const actualByItem = new Map<string, number>();
  if (session) {
    const agg = await aggregateSessionCounts(session.id);
    for (const a of agg) actualByItem.set(a.inventoryItemId, a.totalQty);
  }

  const salesByItem = new Map<string, number>();
  for (const order of orders) {
    for (const oi of order.items) {
      for (const rl of oi.menuItem.recipeLines) {
        const raw = rawQuantityForSellable(
          rl.quantity * oi.quantity,
          rl.inventoryItem.yieldPct ?? 100
        );
        salesByItem.set(rl.inventoryItemId, (salesByItem.get(rl.inventoryItemId) ?? 0) + raw);
      }
    }
  }

  const purchasesByItem = new Map<string, number>();
  for (const r of receipts) {
    if (r.inventoryItemId) {
      purchasesByItem.set(
        r.inventoryItemId,
        (purchasesByItem.get(r.inventoryItemId) ?? 0) + r.qtyReceived
      );
    }
  }

  const lines: MonthlyVarianceLine[] = [];

  for (const item of inventory) {
    const opening = openingByItem.get(item.id) ?? 0;
    const purchases = purchasesByItem.get(item.id) ?? 0;
    const sales = salesByItem.get(item.id) ?? 0;
    const theoretical = opening + purchases - sales;
    const actual = actualByItem.get(item.id) ?? item.quantity;
    const varianceQty = actual - theoretical;
    const variancePct = theoretical !== 0 ? (varianceQty / Math.abs(theoretical)) * 100 : 0;
    const costPerUnit = await getLatestInvoicePrice(locationId, item.id);

    let flag: MonthlyVarianceLine["flag"] = "OK";
    if (variancePct > 8) flag = "OVER";
    else if (variancePct < -8) flag = "UNDER";

    if (opening <= 0 && purchases <= 0 && sales <= 0 && !actualByItem.has(item.id)) continue;

    lines.push({
      inventoryItemId: item.id,
      name: item.name,
      unit: item.unit,
      openingQty: Math.round(opening * 100) / 100,
      purchasesQty: Math.round(purchases * 100) / 100,
      theoreticalQty: Math.round(theoretical * 100) / 100,
      actualQty: Math.round(actual * 100) / 100,
      varianceQty: Math.round(varianceQty * 100) / 100,
      variancePct: Math.round(variancePct * 10) / 10,
      varianceCost: Math.round(varianceQty * costPerUnit * 100) / 100,
      costPerUnit,
      flag,
    });
  }

  lines.sort((a, b) => Math.abs(b.varianceCost) - Math.abs(a.varianceCost));
  return lines;
}

export async function computeMonthlyCogs(
  locationId: string,
  periodMonth: Date
): Promise<MonthlyCountReport> {
  const monthStart = startOfMonth(periodMonth);
  const monthEnd = endOfMonth(periodMonth);

  const varianceLines = await computeMonthlyVariance(locationId, periodMonth);

  const session = await prisma.inventoryCountSession.findFirst({
    where: {
      locationId,
      sessionType: "MONTHLY",
      periodMonth: monthStart,
    },
    include: { lines: { include: { inventoryItem: true } } },
  });

  const aggregatedCounts = session
    ? await aggregateSessionCounts(session.id)
    : [];

  let openingValue = 0;
  let closingValue = 0;
  let purchasesValue = 0;

  for (const line of varianceLines) {
    openingValue += line.openingQty * line.costPerUnit;
    closingValue += line.actualQty * line.costPerUnit;
    purchasesValue += line.purchasesQty * line.costPerUnit;
  }

  const orders = await prisma.order.findMany({
    where: {
      locationId,
      status: { in: ["PAID", "SERVED", "READY"] },
      createdAt: { gte: monthStart, lte: monthEnd },
    },
    select: { totalAmount: true },
  });
  const revenue = orders.reduce((s, o) => s + o.totalAmount, 0);

  const cogsAmount = openingValue + purchasesValue - closingValue;
  const cogsPct = revenue > 0 ? (cogsAmount / revenue) * 100 : 0;

  const shrinkage = varianceLines.filter((l) => l.flag === "UNDER").length;
  const summary =
    shrinkage > 0
      ? `${shrinkage} item(s) below theoretical — review shrinkage and portioning`
      : "Monthly count complete — variance within normal range";

  return {
    periodMonth: format(monthStart, "MMMM yyyy"),
    totalInventoryValue: Math.round(closingValue * 100) / 100,
    openingValue: Math.round(openingValue * 100) / 100,
    purchasesValue: Math.round(purchasesValue * 100) / 100,
    cogsAmount: Math.round(cogsAmount * 100) / 100,
    cogsPct: Math.round(cogsPct * 10) / 10,
    revenue: Math.round(revenue * 100) / 100,
    varianceLines,
    aggregatedCounts,
    summary,
  };
}

export async function finalizeMonthlyCount(sessionId: string, locationId: string) {
  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, locationId, sessionType: "MONTHLY" },
    include: { lines: { include: { inventoryItem: true } } },
  });
  if (!session) throw new Error("Session not found");
  if (session.status === "FINALIZED") throw new Error("Already finalized");

  const aggregated = await aggregateSessionCounts(sessionId);

  for (const agg of aggregated) {
    await prisma.inventoryItem.update({
      where: { id: agg.inventoryItemId },
      data: { quantity: agg.totalQty },
    });
  }

  const updated = await prisma.inventoryCountSession.update({
    where: { id: sessionId },
    data: {
      status: "FINALIZED",
      finalizedAt: new Date(),
    },
    include: { lines: { include: { inventoryItem: true, zone: true } } },
  });

  const periodMonth = session.periodMonth ?? new Date();
  const report = await computeMonthlyCogs(locationId, periodMonth);

  await prisma.inventoryCountSession.update({
    where: { id: sessionId },
    data: {
      notes: JSON.stringify({
        cogsPct: report.cogsPct,
        cogsAmount: report.cogsAmount,
        totalInventoryValue: report.totalInventoryValue,
      }),
    },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "MONTHLY_COUNT_FINALIZE",
      entity: "count_session",
      entityId: sessionId,
      details: `Monthly count ${format(periodMonth, "MMM yyyy")} — COGS ${report.cogsPct}% — ${aggregated.length} items`,
    },
  });

  return { session: updated, report };
}

export async function syncMonthlyOfflineLines(
  locationId: string,
  sessionId: string,
  lines: CountLineInput[]
) {
  const results = [];
  for (const line of lines) {
    const result = await addMonthlyCountLine(sessionId, locationId, line);
    results.push(result);
  }
  return results;
}

export interface ZoneAssignmentInput {
  zoneId: string;
  staffMemberId: string | null;
}

export async function setZoneAssignments(
  sessionId: string,
  locationId: string,
  assignments: ZoneAssignmentInput[]
) {
  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, locationId, sessionType: "MONTHLY", status: "IN_PROGRESS" },
  });
  if (!session) throw new Error("Monthly count session not found or already finalized");

  for (const { zoneId, staffMemberId } of assignments) {
    if (!staffMemberId) {
      await prisma.countZoneAssignment.deleteMany({ where: { sessionId, zoneId } });
      continue;
    }

    const staff = await prisma.staffMember.findFirst({
      where: { id: staffMemberId, locationId, active: true },
    });
    if (!staff) throw new Error("Staff member not found");

    const zone = await prisma.storageZone.findFirst({
      where: { id: zoneId, locationId },
    });
    if (!zone) throw new Error("Storage zone not found");

    await prisma.countZoneAssignment.upsert({
      where: { sessionId_zoneId: { sessionId, zoneId } },
      create: { sessionId, zoneId, staffMemberId },
      update: { staffMemberId, assignedAt: new Date() },
    });
  }

  return prisma.countZoneAssignment.findMany({
    where: { sessionId },
    include: {
      zone: { select: { id: true, name: true, slug: true, sortOrder: true } },
      staffMember: { select: { id: true, name: true, role: true } },
    },
  }).then((rows) =>
    rows.sort((a, b) => (a.zone.sortOrder ?? 0) - (b.zone.sortOrder ?? 0))
  );
}

export async function getZoneAssignments(sessionId: string) {
  const rows = await prisma.countZoneAssignment.findMany({
    where: { sessionId },
    include: {
      zone: { select: { id: true, name: true, slug: true, sortOrder: true } },
      staffMember: { select: { id: true, name: true, role: true } },
    },
  });
  return rows.sort((a, b) => (a.zone.sortOrder ?? 0) - (b.zone.sortOrder ?? 0));
}

export function zoneProgress(
  zoneId: string,
  lines: { zoneId?: string | null; inventoryItemId: string }[],
  routeItemCount: number
) {
  const counted = new Set(
    lines.filter((l) => l.zoneId === zoneId).map((l) => l.inventoryItemId)
  ).size;
  return { counted, total: routeItemCount };
}
