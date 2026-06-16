import { addDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatYieldNote } from "./yield";
import { formatPortionLabel, roundKitchenQty } from "./portion";
import { getPlatingSpec } from "./plating-catalog";
import {
  dayOfWeekName,
  daypartFromHour,
  DAYPART_LABELS,
  DAYPART_SHORT,
  MEAL_DAYPARTS,
  type Daypart,
  type MealDaypart,
} from "./daypart";

export { formatYieldNote };

export interface PrepIngredientLine {
  ingredient: string;
  inventoryItemId: string;
  unit: string;
  perPlateQty: number;
  perPlateLabel: string;
  portionSize: number | null;
  rawQtyNeeded: number;
  sellableQtyNeeded: number;
  prepQty: number;
  yieldPct: number;
  onHand: number;
  priority: "HIGH" | "NORMAL";
}

export interface PrepMenuItem {
  menuItemId: string;
  menuItemName: string;
  category: string;
  forecastPlates: number;
  trendVsWeekAvgPct: number;
  daypart: Daypart;
  portionSpec: string;
  platingNotes: string;
  plateware: string | null;
  garnish: string | null;
  ingredients: PrepIngredientLine[];
}

export interface PrepTask {
  ingredient: string;
  unit: string;
  rawQtyNeeded: number;
  sellableQtyNeeded: number;
  onHand: number;
  prepQty: number;
  yieldPct: number;
  forMenuItems: string[];
  priority: "HIGH" | "NORMAL";
  daypart: Daypart;
}

export interface PrepDaypartBlock {
  daypart: Daypart;
  label: string;
  forecastCovers: number;
  trendVsWeekAvgPct: number;
  menuItems: PrepMenuItem[];
  tasks: PrepTask[];
}

export interface PrepList {
  date: string;
  dayOfWeek: string;
  forecastCovers: number;
  menuItems: PrepMenuItem[];
  dayparts: PrepDaypartBlock[];
  tasks: PrepTask[];
  summary: string;
  aiInsight: string;
}

const LOOKBACK_DAYS = 42;

type DailyBucket = Map<Daypart, Map<string, number>>;

function dateKey(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Historical sales: date → daypart → menuItemId → qty */
function buildDailySalesMatrix(
  orders: Array<{
    createdAt: Date;
    guestCount: number;
    items: Array<{ menuItemId: string; quantity: number }>;
  }>
): {
  dailyMenu: Map<string, DailyBucket>;
  dailyCovers: Map<string, Map<Daypart, number>>;
} {
  const dailyMenu = new Map<string, DailyBucket>();
  const dailyCovers = new Map<string, Map<Daypart, number>>();

  for (const order of orders) {
    const dk = dateKey(order.createdAt);
    const dp = daypartFromHour(order.createdAt.getHours());

    if (!dailyMenu.has(dk)) dailyMenu.set(dk, new Map());
    const dayMap = dailyMenu.get(dk)!;
    if (!dayMap.has(dp)) dayMap.set(dp, new Map());
    const menuMap = dayMap.get(dp)!;

    if (!dailyCovers.has(dk)) dailyCovers.set(dk, new Map());
    const coverMap = dailyCovers.get(dk)!;
    coverMap.set(dp, (coverMap.get(dp) ?? 0) + (order.guestCount || 1));

    for (const item of order.items) {
      menuMap.set(item.menuItemId, (menuMap.get(item.menuItemId) ?? 0) + item.quantity);
    }
  }

  return { dailyMenu, dailyCovers };
}

function forecastMenuQty(
  menuItemId: string,
  targetDow: number,
  daypart: Daypart,
  dailyMenu: Map<string, DailyBucket>,
  fallbackByDaypart: Map<Daypart, Map<string, number>>
): number {
  const samples: number[] = [];

  for (const [dk, dayMap] of dailyMenu) {
    const d = new Date(dk + "T12:00:00");
    if (d.getDay() !== targetDow) continue;
    const qty = dayMap.get(daypart)?.get(menuItemId) ?? 0;
    if (qty > 0) samples.push(qty);
  }

  if (samples.length > 0) {
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
    return Math.max(0.5, Math.ceil(avg * 10) / 10);
  }

  const fallback = fallbackByDaypart.get(daypart)?.get(menuItemId) ?? 0;
  if (fallback > 0) return Math.max(0.5, Math.ceil(fallback * 10) / 10);
  return 0;
}

function forecastCoversForDaypart(
  targetDow: number,
  daypart: Daypart,
  dailyCovers: Map<string, Map<Daypart, number>>
): { forecast: number; trendPct: number } {
  const dowSamples: number[] = [];
  const allSamples: number[] = [];

  for (const [dk, coverMap] of dailyCovers) {
    const covers = coverMap.get(daypart) ?? 0;
    if (covers <= 0) continue;
    allSamples.push(covers);
    const d = new Date(dk + "T12:00:00");
    if (d.getDay() === targetDow) dowSamples.push(covers);
  }

  const forecast =
    dowSamples.length > 0
      ? Math.round(dowSamples.reduce((s, v) => s + v, 0) / dowSamples.length)
      : allSamples.length > 0
        ? Math.round(allSamples.reduce((s, v) => s + v, 0) / allSamples.length)
        : 0;

  const weekAvg =
    allSamples.length > 0 ? allSamples.reduce((s, v) => s + v, 0) / allSamples.length : forecast;
  const trendPct =
    weekAvg > 0 ? Math.round(((forecast - weekAvg) / weekAvg) * 100) : 0;

  return { forecast, trendPct };
}

function buildFallbackByDaypart(
  dailyMenu: Map<string, DailyBucket>
): Map<Daypart, Map<string, number>> {
  const totals = new Map<Daypart, Map<string, { sum: number; days: number }>>();
  const dayCount = new Map<Daypart, number>();

  for (const dayMap of dailyMenu.values()) {
    for (const [dp, menuMap] of dayMap) {
      dayCount.set(dp, (dayCount.get(dp) ?? 0) + 1);
      if (!totals.has(dp)) totals.set(dp, new Map());
      const t = totals.get(dp)!;
      for (const [menuId, qty] of menuMap) {
        const cur = t.get(menuId) ?? { sum: 0, days: 0 };
        cur.sum += qty;
        cur.days += 1;
        t.set(menuId, cur);
      }
    }
  }

  const result = new Map<Daypart, Map<string, number>>();
  for (const [dp, menuTotals] of totals) {
    const days = dayCount.get(dp) ?? 1;
    const m = new Map<string, number>();
    for (const [menuId, { sum }] of menuTotals) {
      m.set(menuId, sum / days);
    }
    result.set(dp, m);
  }
  return result;
}

function forecastMenuItemTrend(
  menuItemId: string,
  targetDow: number,
  daypart: Daypart,
  dailyMenu: Map<string, DailyBucket>
): number {
  const dowSamples: number[] = [];
  const allSamples: number[] = [];

  for (const [dk, dayMap] of dailyMenu) {
    const qty = dayMap.get(daypart)?.get(menuItemId) ?? 0;
    if (qty <= 0) continue;
    allSamples.push(qty);
    const d = new Date(dk + "T12:00:00");
    if (d.getDay() === targetDow) dowSamples.push(qty);
  }

  const forecast =
    dowSamples.length > 0
      ? dowSamples.reduce((s, v) => s + v, 0) / dowSamples.length
      : allSamples.length > 0
        ? allSamples.reduce((s, v) => s + v, 0) / allSamples.length
        : 0;

  const weekAvg =
    allSamples.length > 0 ? allSamples.reduce((s, v) => s + v, 0) / allSamples.length : forecast;
  return weekAvg > 0 ? Math.round(((forecast - weekAvg) / weekAvg) * 100) : 0;
}

function buildMenuItemPrep(
  menuItems: Array<{
    id: string;
    name: string;
    category: string;
    recipeLines: Array<{
      quantity: number;
      inventoryItemId: string;
      inventoryItem: { name: string; unit: string; yieldPct: number; portionSize: number | null };
    }>;
  }>,
  forecastQty: (menuItemId: string) => number,
  invMap: Map<string, { id: string; name: string; unit: string; quantity: number }>,
  daypart: Daypart,
  targetDow: number,
  dailyMenu: Map<string, DailyBucket>
): PrepMenuItem[] {
  const blocks: PrepMenuItem[] = [];

  for (const menu of menuItems) {
    const plates = forecastQty(menu.id);
    if (plates <= 0) continue;

    const ingredients: PrepIngredientLine[] = [];
    for (const line of menu.recipeLines) {
      const yieldPct = line.inventoryItem.yieldPct ?? 100;
      const perPlateQty = line.quantity;
      const sellable = perPlateQty * plates;
      const raw = sellable / (yieldPct / 100);
      const inv = invMap.get(line.inventoryItemId);
      const portionSize = line.inventoryItem.portionSize;

      ingredients.push({
        ingredient: line.inventoryItem.name,
        inventoryItemId: line.inventoryItemId,
        unit: line.inventoryItem.unit,
        perPlateQty: roundKitchenQty(perPlateQty),
        perPlateLabel: formatPortionLabel(perPlateQty, line.inventoryItem.unit, portionSize),
        portionSize,
        rawQtyNeeded: round1(raw),
        sellableQtyNeeded: round1(sellable),
        prepQty: round1(raw),
        yieldPct,
        onHand: inv?.quantity ?? 0,
        priority: "NORMAL",
      });
    }

    const plating = getPlatingSpec(menu.name);

    blocks.push({
      menuItemId: menu.id,
      menuItemName: menu.name,
      category: menu.category,
      forecastPlates: round1(plates),
      trendVsWeekAvgPct: forecastMenuItemTrend(menu.id, targetDow, daypart, dailyMenu),
      daypart,
      portionSpec: plating?.portionSpec ?? "Per recipe below",
      platingNotes: plating?.platingNotes ?? "",
      plateware: plating?.plateware ?? null,
      garnish: plating?.garnish ?? null,
      ingredients,
    });
  }

  blocks.sort((a, b) => b.forecastPlates - a.forecastPlates);
  return blocks;
}

function mergeDailyMenuItems(dayparts: PrepDaypartBlock[]): PrepMenuItem[] {
  const map = new Map<string, PrepMenuItem>();

  for (const block of dayparts) {
    for (const item of block.menuItems) {
      const existing = map.get(item.menuItemId);
      if (!existing) {
        map.set(item.menuItemId, {
          ...item,
          daypart: "lunch" as Daypart,
          ingredients: item.ingredients.map((ing) => ({ ...ing })),
        });
        continue;
      }

      existing.forecastPlates = round1(existing.forecastPlates + item.forecastPlates);
      const trendWeight = item.forecastPlates / (existing.forecastPlates || 1);
      existing.trendVsWeekAvgPct = Math.round(
        existing.trendVsWeekAvgPct * (1 - trendWeight) + item.trendVsWeekAvgPct * trendWeight
      );

      for (const ing of item.ingredients) {
        const match = existing.ingredients.find((e) => e.inventoryItemId === ing.inventoryItemId);
        if (match) {
          match.rawQtyNeeded = round1(match.rawQtyNeeded + ing.rawQtyNeeded);
          match.sellableQtyNeeded = round1(match.sellableQtyNeeded + ing.sellableQtyNeeded);
          match.prepQty = round1(match.prepQty + ing.prepQty);
        } else {
          existing.ingredients.push({ ...ing });
        }
      }
    }
  }

  return [...map.values()].sort((a, b) => b.forecastPlates - a.forecastPlates);
}

function buildIngredientTasks(
  menuItems: Array<{
    id: string;
    name: string;
    recipeLines: Array<{
      quantity: number;
      inventoryItemId: string;
      inventoryItem: { name: string; unit: string; yieldPct: number; quantity: number; minQuantity: number };
    }>;
  }>,
  forecastQty: (menuItemId: string) => number,
  invMap: Map<string, { id: string; name: string; unit: string; quantity: number; minQuantity: number }>,
  daypart: Daypart
): PrepTask[] {
  const ingredientNeed = new Map<
    string,
    { raw: number; sellable: number; unit: string; yieldPct: number; menus: Set<string> }
  >();

  for (const menu of menuItems) {
    const plates = forecastQty(menu.id);
    if (plates <= 0 || !menu.recipeLines.length) continue;

    for (const line of menu.recipeLines) {
      const yieldPct = line.inventoryItem.yieldPct ?? 100;
      const sellablePerPlate = line.quantity * plates;
      const rawPerPlate = sellablePerPlate / (yieldPct / 100);
      const key = line.inventoryItemId;
      const existing = ingredientNeed.get(key) ?? {
        raw: 0,
        sellable: 0,
        unit: line.inventoryItem.unit,
        yieldPct,
        menus: new Set<string>(),
      };
      existing.raw += rawPerPlate;
      existing.sellable += sellablePerPlate;
      existing.menus.add(menu.name);
      ingredientNeed.set(key, existing);
    }
  }

  const tasks: PrepTask[] = [];
  for (const [inventoryItemId, need] of ingredientNeed) {
    const inv = invMap.get(inventoryItemId);
    if (!inv) continue;

    const prepQty = Math.max(0, round1(need.raw - inv.quantity));
    if (prepQty <= 0 && need.raw <= inv.quantity * 0.5) continue;

    tasks.push({
      ingredient: inv.name,
      unit: need.unit,
      rawQtyNeeded: round1(need.raw),
      sellableQtyNeeded: round1(need.sellable),
      onHand: inv.quantity,
      prepQty: prepQty > 0 ? prepQty : round1(need.raw),
      yieldPct: need.yieldPct,
      forMenuItems: [...need.menus],
      priority: prepQty > 0 || inv.quantity < inv.minQuantity ? "HIGH" : "NORMAL",
      daypart,
    });
  }

  tasks.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "HIGH" ? -1 : 1;
    return b.prepQty - a.prepQty;
  });

  return tasks;
}

function buildAiInsight(
  dayOfWeek: string,
  dayparts: PrepDaypartBlock[],
  forecastCovers: number
): string {
  const parts: string[] = [];
  const mealBlocks = dayparts.filter((d) => MEAL_DAYPARTS.includes(d.daypart as MealDaypart));

  for (const block of mealBlocks) {
    if (block.forecastCovers === 0 && block.menuItems.length === 0) continue;
    const trend =
      block.trendVsWeekAvgPct > 5
        ? `${block.trendVsWeekAvgPct}% above your weekly ${DAYPART_SHORT[block.daypart].toLowerCase()} average`
        : block.trendVsWeekAvgPct < -5
          ? `${Math.abs(block.trendVsWeekAvgPct)}% below weekly ${DAYPART_SHORT[block.daypart].toLowerCase()} average`
          : `in line with weekly ${DAYPART_SHORT[block.daypart].toLowerCase()} average`;

    const topItems = block.menuItems
      .filter((m) => m.forecastPlates > 0)
      .slice(0, 2)
      .map((m) => `${m.menuItemName} (~${m.forecastPlates})`)
      .join(", ");
    const top = block.tasks.filter((t) => t.priority === "HIGH").slice(0, 2);
    const topNames = top.map((t) => t.ingredient).join(", ");
    parts.push(
      `${DAYPART_SHORT[block.daypart]}: ~${block.forecastCovers} covers (${trend})${
        topItems ? ` — top sellers: ${topItems}` : ""
      }${topNames ? ` · prep ${topNames}` : ""}`
    );
  }

  if (parts.length === 0) {
    return `Prep forecast for ${dayOfWeek}: limited history — using blended sales velocity (~${forecastCovers} covers).`;
  }

  return `${dayOfWeek} prep plan from ${LOOKBACK_DAYS}-day trends: ${parts.join(". ")}.`;
}

export async function generatePrepList(locationId: string, targetDate = new Date()): Promise<PrepList> {
  const periodStart = addDays(startOfDay(targetDate), -LOOKBACK_DAYS);
  const targetDow = targetDate.getDay();
  const dayOfWeek = dayOfWeekName(targetDow);

  const [orders, menuItems, inventory] = await Promise.all([
    prisma.order.findMany({
      where: {
        locationId,
        status: { in: ["PAID", "SERVED", "READY", "PREPARING"] },
        createdAt: { gte: periodStart },
      },
      include: {
        items: { select: { menuItemId: true, quantity: true } },
      },
    }),
    prisma.menuItem.findMany({
      where: { locationId, available: true },
      include: { recipeLines: { include: { inventoryItem: true } } },
    }),
    prisma.inventoryItem.findMany({ where: { locationId } }),
  ]);

  const invMap = new Map(inventory.map((i) => [i.id, i]));
  const { dailyMenu, dailyCovers } = buildDailySalesMatrix(orders);
  const fallbackByDaypart = buildFallbackByDaypart(dailyMenu);

  const dayparts: PrepDaypartBlock[] = [];
  const allTasks: PrepTask[] = [];

  const daypartOrder: Daypart[] = [...MEAL_DAYPARTS, "late"];

  for (const dp of daypartOrder) {
    const { forecast, trendPct } = forecastCoversForDaypart(targetDow, dp, dailyCovers);

    const forecastQty = (menuItemId: string) =>
      forecastMenuQty(menuItemId, targetDow, dp, dailyMenu, fallbackByDaypart);

    const menuItemBlocks = buildMenuItemPrep(
      menuItems,
      forecastQty,
      invMap,
      dp,
      targetDow,
      dailyMenu
    );
    const tasks = buildIngredientTasks(menuItems, forecastQty, invMap, dp);

    if (dp === "late" && menuItemBlocks.length === 0 && forecast === 0) continue;

    dayparts.push({
      daypart: dp,
      label: DAYPART_LABELS[dp],
      forecastCovers: forecast,
      trendVsWeekAvgPct: trendPct,
      menuItems: menuItemBlocks,
      tasks,
    });
    allTasks.push(...tasks);
  }

  const dailyMenuItems = mergeDailyMenuItems(dayparts);

  const forecastCovers = dayparts
    .filter((d) => MEAL_DAYPARTS.includes(d.daypart as MealDaypart))
    .reduce((s, d) => s + d.forecastCovers, 0);

  const menuItemCount = dailyMenuItems.length;
  const ingredientLines = dailyMenuItems.reduce((s, m) => s + m.ingredients.length, 0);
  const summary = `${menuItemCount} menu items · ${ingredientLines} ingredient prep lines for ${dayOfWeek} — forecast from ${LOOKBACK_DAYS}-day trends (~${forecastCovers} covers)`;

  return {
    date: dateKey(targetDate),
    dayOfWeek,
    forecastCovers,
    menuItems: dailyMenuItems,
    dayparts,
    tasks: allTasks,
    summary,
    aiInsight: buildAiInsight(dayOfWeek, dayparts, forecastCovers),
  };
}

/** Scale prep quantities (Crystal Ball weather overlay). */
export function scalePrepList(prepList: PrepList, multiplier: number, note?: string): PrepList {
  const scaleIng = (ing: PrepIngredientLine): PrepIngredientLine => ({
    ...ing,
    rawQtyNeeded: round1(ing.rawQtyNeeded * multiplier),
    sellableQtyNeeded: round1(ing.sellableQtyNeeded * multiplier),
    prepQty: round1(ing.prepQty * multiplier),
  });

  const scaleMenu = (m: PrepMenuItem): PrepMenuItem => ({
    ...m,
    forecastPlates: round1(m.forecastPlates * multiplier),
    ingredients: m.ingredients.map(scaleIng),
  });

  const scale = (t: PrepTask): PrepTask => ({
    ...t,
    rawQtyNeeded: round1(t.rawQtyNeeded * multiplier),
    prepQty: round1(t.prepQty * multiplier),
  });

  return {
    ...prepList,
    forecastCovers: Math.round(prepList.forecastCovers * multiplier),
    menuItems: prepList.menuItems.map(scaleMenu),
    dayparts: prepList.dayparts.map((d) => ({
      ...d,
      forecastCovers: Math.round(d.forecastCovers * multiplier),
      menuItems: d.menuItems.map(scaleMenu),
      tasks: d.tasks.map(scale),
    })),
    tasks: prepList.tasks.map(scale),
    summary: note ? `${prepList.summary} · ${note}` : prepList.summary,
  };
}
