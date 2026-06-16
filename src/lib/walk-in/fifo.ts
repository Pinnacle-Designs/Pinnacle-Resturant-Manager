import { addDays, differenceInDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export interface FifoAlert {
  lotId: string;
  itemName: string;
  quantity: number;
  unit: string;
  expiresAt: Date;
  daysUntilExpiry: number;
  zoneName?: string;
  severity: "EXPIRING" | "EXPIRED" | "USE_FIRST";
}

export async function getFifoAlerts(locationId: string): Promise<FifoAlert[]> {
  const now = new Date();
  const lots = await prisma.inventoryLot.findMany({
    where: { locationId, quantity: { gt: 0 } },
    include: { inventoryItem: true, zone: true },
    orderBy: [{ inventoryItemId: "asc" }, { receivedAt: "asc" }],
  });

  const alerts: FifoAlert[] = [];
  const byItem = new Map<string, typeof lots>();

  for (const lot of lots) {
    const key = lot.inventoryItemId;
    if (!byItem.has(key)) byItem.set(key, []);
    byItem.get(key)!.push(lot);
  }

  for (const [, itemLots] of byItem) {
    const sorted = [...itemLots].sort(
      (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
    );
    const oldest = sorted[0]!;

    for (const lot of sorted) {
      if (!lot.expiresAt) continue;
      const days = differenceInDays(lot.expiresAt, now);
      if (days < 0) {
        alerts.push({
          lotId: lot.id,
          itemName: lot.inventoryItem.name,
          quantity: lot.quantity,
          unit: lot.unit,
          expiresAt: lot.expiresAt,
          daysUntilExpiry: days,
          zoneName: lot.zone?.name,
          severity: "EXPIRED",
        });
      } else if (days <= 3) {
        alerts.push({
          lotId: lot.id,
          itemName: lot.inventoryItem.name,
          quantity: lot.quantity,
          unit: lot.unit,
          expiresAt: lot.expiresAt,
          daysUntilExpiry: days,
          zoneName: lot.zone?.name,
          severity: "EXPIRING",
        });
      }
    }

    if (sorted.length > 1 && oldest.quantity > 0) {
      const newer = sorted.slice(1).filter((l) => l.quantity > 0);
      if (newer.length > 0) {
        alerts.push({
          lotId: oldest.id,
          itemName: oldest.inventoryItem.name,
          quantity: oldest.quantity,
          unit: oldest.unit,
          expiresAt: oldest.expiresAt ?? addDays(oldest.receivedAt, 30),
          daysUntilExpiry: oldest.expiresAt
            ? differenceInDays(oldest.expiresAt, now)
            : 99,
          zoneName: oldest.zone?.name,
          severity: "USE_FIRST",
        });
      }
    }
  }

  return alerts.sort((a, b) => {
    const order = { EXPIRED: 0, EXPIRING: 1, USE_FIRST: 2 };
    return order[a.severity] - order[b.severity] || a.daysUntilExpiry - b.daysUntilExpiry;
  });
}

export async function createFifoInsights(locationId: string) {
  const alerts = await getFifoAlerts(locationId);
  const critical = alerts.filter((a) => a.severity === "EXPIRED" || a.severity === "EXPIRING");

  for (const alert of critical.slice(0, 5)) {
    const title =
      alert.severity === "EXPIRED"
        ? `Expired: ${alert.itemName}`
        : `Expiring soon: ${alert.itemName}`;

    const existing = await prisma.businessInsight.findFirst({
      where: { locationId, resolved: false, title },
    });
    if (existing) continue;

    await prisma.businessInsight.create({
      data: {
        locationId,
        title,
        description: `${alert.quantity} ${alert.unit} in ${alert.zoneName ?? "storage"} — ${alert.severity === "EXPIRED" ? "discard or waste immediately" : `use within ${alert.daysUntilExpiry} day(s)`}. Pull older lots first (FIFO).`,
        category: "INVENTORY",
        severity: alert.severity === "EXPIRED" ? "CRITICAL" : "HIGH",
        actionable: "Use or waste oldest batch first",
        dataSnapshot: JSON.stringify(alert),
      },
    });
  }
}
