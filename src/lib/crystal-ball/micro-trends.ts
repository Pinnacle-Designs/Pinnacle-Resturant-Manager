import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export interface MicroTrend {
  id: string;
  itemName: string;
  category: string;
  trigger: string;
  impactPct: number;
  confidence: "low" | "medium" | "high";
  action: string;
  sampleSize: number;
}

function dayTag(date: Date, factors: { date: Date; description: string; factorType: string }[]): string[] {
  const key = date.toISOString().split("T")[0]!;
  const tags: string[] = [];
  const month = date.getMonth();
  const day = date.getDate();

  for (const f of factors) {
    if (f.date.toISOString().split("T")[0] !== key) continue;
    const text = `${f.factorType} ${f.description}`.toLowerCase();
    if (/rain|storm|shower/i.test(text)) tags.push("rainy");
    if (/sun|clear|fair|hot|warm/i.test(text)) tags.push("sunny");
    if (/game|concert|festival|event/i.test(text)) tags.push("event");
    if (/holiday|memorial|july 4/i.test(text)) tags.push("holiday");
  }

  if (month >= 2 && month <= 4 && tags.length === 0) {
    tags.push("spring");
  }

  return tags.length ? tags : ["baseline"];
}

export async function detectMicroTrends(locationId: string): Promise<MicroTrend[]> {
  const since = addDays(new Date(), -90);

  const [orders, factors, menuItems] = await Promise.all([
    prisma.order.findMany({
      where: { locationId, status: "PAID", createdAt: { gte: since } },
      include: { items: { include: { menuItem: true } } },
    }),
    prisma.externalFactor.findMany({ where: { locationId, date: { gte: since } } }),
    prisma.menuItem.findMany({ where: { locationId } }),
  ]);

  const itemDaySales = new Map<string, Map<string, number>>();
  const dayTags = new Map<string, string[]>();

  for (const order of orders) {
    const dk = order.createdAt.toISOString().split("T")[0]!;
    if (!dayTags.has(dk)) {
      dayTags.set(dk, dayTag(order.createdAt, factors));
    }
    for (const oi of order.items) {
      if (!itemDaySales.has(oi.menuItemId)) itemDaySales.set(oi.menuItemId, new Map());
      const m = itemDaySales.get(oi.menuItemId)!;
      m.set(dk, (m.get(dk) ?? 0) + oi.quantity);
    }
  }

  const menuMap = new Map(menuItems.map((m) => [m.id, m]));
  const trends: MicroTrend[] = [];

  const tagGroups = ["rainy", "sunny", "event", "holiday", "spring"] as const;

  for (const [menuItemId, daySales] of itemDaySales) {
    const menu = menuMap.get(menuItemId);
    if (!menu) continue;

    const baselineDays: number[] = [];
    const tagBuckets: Record<string, number[]> = {
      rainy: [],
      sunny: [],
      event: [],
      holiday: [],
      spring: [],
    };

    for (const [dk, qty] of daySales) {
      const tags = dayTags.get(dk) ?? ["baseline"];
      if (tags.includes("baseline") && tags.length === 1) {
        baselineDays.push(qty);
      }
      for (const tag of tagGroups) {
        if (tags.includes(tag)) tagBuckets[tag].push(qty);
      }
    }

    const baseline =
      baselineDays.length > 0
        ? baselineDays.reduce((s, v) => s + v, 0) / baselineDays.length
        : [...daySales.values()].reduce((s, v) => s + v, 0) / daySales.size;

    if (baseline <= 0) continue;

    for (const tag of tagGroups) {
      const samples = tagBuckets[tag];
      if (samples.length < 2) continue;

      const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
      const impactPct = Math.round(((avg - baseline) / baseline) * 1000) / 10;
      if (Math.abs(impactPct) < 10) continue;

      const isBar = /bar|beer|ipa|lager|bourbon|cocktail|drink/i.test(
        `${menu.name} ${menu.category}`
      );

      let trigger = "";
      let action = "";

      if (tag === "sunny" && impactPct > 0) {
        trigger = isBar
          ? "First sunny patio days of spring"
          : "Warm sunny days";
        action = isBar
          ? `Order extra ${menu.name} — patio traffic historically +${impactPct}%`
          : `Bump par on ${menu.name} for patio service`;
      } else if (tag === "rainy") {
        trigger = "Rainy days";
        action =
          impactPct > 0
            ? `Delivery/catering lifts ${menu.name} — stock up`
            : `Dine-in drops ${menu.name} on rain — reduce prep`;
      } else if (tag === "event") {
        trigger = "Local events & game days";
        action = `Event nights sell +${impactPct}% more ${menu.name}`;
      } else if (tag === "holiday") {
        trigger = "Holiday weekends";
        action = `Holiday demand spike for ${menu.name}`;
      } else if (tag === "spring" && isBar && impactPct > 0) {
        trigger = "Spring patio season ramp";
        action = `IPA/bar sales spike ~${impactPct}% on first warm weeks — order accordingly`;
      } else {
        continue;
      }

      trends.push({
        id: `${menuItemId}-${tag}`,
        itemName: menu.name,
        category: menu.category,
        trigger,
        impactPct,
        confidence: samples.length >= 5 ? "high" : samples.length >= 3 ? "medium" : "low",
        action,
        sampleSize: samples.length,
      });
    }
  }

  const sorted = trends.sort((a, b) => Math.abs(b.impactPct) - Math.abs(a.impactPct)).slice(0, 12);

  for (const trend of sorted.filter((t) => t.confidence !== "low" && Math.abs(t.impactPct) >= 12).slice(0, 3)) {
    const title = `Trend: ${trend.itemName}`;
    const existing = await prisma.businessInsight.findFirst({
      where: { locationId, resolved: false, title },
    });
    if (existing) continue;

    await prisma.businessInsight.create({
      data: {
        locationId,
        title,
        description: `${trend.trigger}: ${trend.action}`,
        category: "OPERATIONS",
        severity: trend.impactPct >= 20 ? "HIGH" : "MEDIUM",
        actionable: trend.action,
        dataSnapshot: JSON.stringify(trend),
      },
    });
  }

  return sorted;
}
