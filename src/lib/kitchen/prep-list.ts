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
  inventoryItemId?: string;
  ingredient: string;
  unit: string;
  rawQtyNeeded: number;
  sellableQtyNeeded: number;
  onHand: number;
  /** Gross prep needed for the full day (before carryover / on-hand). */
  prepQty: number;
  /** Unsold prep from yesterday (forecast minus sales usage). */
  carryoverQty: number;
  /** onHand + carryoverQty — available before new prep. */
  availableQty: number;
  /** max(0, prepQty - availableQty) */
  stillNeedQty: number;
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

export interface PrepTotalBlock {
  label: string;
  forecastCovers: number;
  breakfastCovers: number;
  lunchCovers: number;
  dinnerCovers: number;
  /** Date (YYYY-MM-DD) carryover was computed from — typically yesterday. */
  carryoverFromDate?: string;
  tasks: PrepTask[];
}

export interface PrepList {
  date: string;
  dayOfWeek: string;
  forecastCovers: number;
  menuItems: PrepMenuItem[];
  totalPrep: PrepTotalBlock;
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

/** Combined ingredient need for breakfast + lunch + dinner. */
function aggregateMealIngredientNeed(dayparts: PrepDaypartBlock[]): Map<
  string,
  { raw: number; sellable: number; unit: string; yieldPct: number; menus: Set<string> }
> {
  const ingredientNeed = new Map<
    string,
    { raw: number; sellable: number; unit: string; yieldPct: number; menus: Set<string> }
  >();

  for (const block of dayparts) {
    if (!MEAL_DAYPARTS.includes(block.daypart as MealDaypart)) continue;
    for (const item of block.menuItems) {
      for (const ing of item.ingredients) {
        const existing = ingredientNeed.get(ing.inventoryItemId) ?? {
          raw: 0,
          sellable: 0,
          unit: ing.unit,
          yieldPct: ing.yieldPct,
          menus: new Set<string>(),
        };
        existing.raw += ing.rawQtyNeeded;
        existing.sellable += ing.sellableQtyNeeded;
        existing.menus.add(item.menuItemName);
        ingredientNeed.set(ing.inventoryItemId, existing);
      }
    }
  }

  return ingredientNeed;
}

/** Raw ingredient usage from sold orders on a single calendar day. */
function computeIngredientUsageForDate(
  date: Date,
  orders: Array<{
    createdAt: Date;
    items: Array<{ menuItemId: string; quantity: number }>;
  }>,
  menuItems: Array<{
    id: string;
    recipeLines: Array<{
      quantity: number;
      inventoryItemId: string;
      inventoryItem: { yieldPct: number };
    }>;
  }>
): Map<string, number> {
  const dk = dateKey(date);
  const menuMap = new Map(menuItems.map((m) => [m.id, m]));
  const usage = new Map<string, number>();

  for (const order of orders) {
    if (dateKey(order.createdAt) !== dk) continue;
    for (const item of order.items) {
      const menu = menuMap.get(item.menuItemId);
      if (!menu) continue;
      for (const line of menu.recipeLines) {
        const yieldPct = line.inventoryItem.yieldPct ?? 100;
        const sellableUsed = line.quantity * item.quantity;
        const rawUsed = sellableUsed / (yieldPct / 100);
        usage.set(
          line.inventoryItemId,
          round1((usage.get(line.inventoryItemId) ?? 0) + rawUsed)
        );
      }
    }
  }

  return usage;
}

/** Leftover prep = yesterday's forecast minus what actually sold (raw qty). */
function computeCarryoverMap(
  yesterdayDayparts: PrepDaypartBlock[],
  yesterdayUsage: Map<string, number>
): Map<string, number> {
  const need = aggregateMealIngredientNeed(yesterdayDayparts);
  const carryover = new Map<string, number>();

  for (const [inventoryItemId, n] of need) {
    const used = yesterdayUsage.get(inventoryItemId) ?? 0;
    const leftover = Math.max(0, round1(n.raw - used));
    if (leftover > 0) carryover.set(inventoryItemId, leftover);
  }

  return carryover;
}

type MenuItemWithRecipes = Array<{
  id: string;
  name: string;
  category: string;
  recipeLines: Array<{
    quantity: number;
    inventoryItemId: string;
    inventoryItem: { name: string; unit: string; yieldPct: number; portionSize: number | null };
  }>;
}>;

function buildDaypartsForDate(
  targetDate: Date,
  menuItems: MenuItemWithRecipes,
  dailyMenu: Map<string, DailyBucket>,
  dailyCovers: Map<string, Map<Daypart, number>>,
  invMap: Map<string, { id: string; name: string; unit: string; quantity: number; minQuantity: number }>,
  fallbackByDaypart: Map<Daypart, Map<string, number>>
): PrepDaypartBlock[] {
  const targetDow = targetDate.getDay();
  const dayparts: PrepDaypartBlock[] = [];
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
  }

  return dayparts;
}

/** Combined ingredient prep for breakfast + lunch + dinner (on-hand + yesterday carryover deducted once). */
function buildTotalPrepTasks(
  dayparts: PrepDaypartBlock[],
  invMap: Map<string, { id: string; name: string; unit: string; quantity: number; minQuantity: number }>,
  carryover: Map<string, number> = new Map()
): PrepTask[] {
  const ingredientNeed = aggregateMealIngredientNeed(dayparts);

  const tasks: PrepTask[] = [];
  for (const [inventoryItemId, need] of ingredientNeed) {
    const inv = invMap.get(inventoryItemId);
    if (!inv) continue;

    const dayTotal = round1(need.raw);
    const carryoverQty = round1(carryover.get(inventoryItemId) ?? 0);
    const availableQty = round1(inv.quantity + carryoverQty);
    const stillNeedQty = Math.max(0, round1(dayTotal - availableQty));

    tasks.push({
      inventoryItemId,
      ingredient: inv.name,
      unit: need.unit,
      rawQtyNeeded: dayTotal,
      sellableQtyNeeded: round1(need.sellable),
      onHand: inv.quantity,
      prepQty: dayTotal,
      carryoverQty,
      availableQty,
      stillNeedQty,
      yieldPct: need.yieldPct,
      forMenuItems: [...need.menus].sort(),
      priority: stillNeedQty > 0 || inv.quantity < inv.minQuantity ? "HIGH" : "NORMAL",
      daypart: "lunch",
    });
  }

  tasks.sort((a, b) => b.stillNeedQty - a.stillNeedQty || b.prepQty - a.prepQty);

  return tasks;
}

function buildTotalPrepBlock(
  dayparts: PrepDaypartBlock[],
  invMap: Map<string, { id: string; name: string; unit: string; quantity: number; minQuantity: number }>,
  carryover: Map<string, number> = new Map(),
  carryoverFromDate?: string
): PrepTotalBlock {
  const covers = (dp: MealDaypart) =>
    dayparts.find((b) => b.daypart === dp)?.forecastCovers ?? 0;

  const breakfastCovers = covers("breakfast");
  const lunchCovers = covers("lunch");
  const dinnerCovers = covers("dinner");
  const forecastCovers = breakfastCovers + lunchCovers + dinnerCovers;

  return {
    label: "Total prep — all ingredients for breakfast + lunch + dinner",
    forecastCovers,
    breakfastCovers,
    lunchCovers,
    dinnerCovers,
    carryoverFromDate,
    tasks: buildTotalPrepTasks(dayparts, invMap, carryover),
  };
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
      carryoverQty: 0,
      availableQty: inv.quantity,
      stillNeedQty: prepQty > 0 ? prepQty : 0,
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
  forecastCovers: number,
  carryover?: Map<string, number>,
  carryoverFromDate?: string
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

  let insight = `${dayOfWeek} prep plan from ${LOOKBACK_DAYS}-day trends: ${parts.join(". ")}.`;

  if (carryover && carryover.size > 0 && carryoverFromDate) {
    const top = [...carryover.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, qty]) => {
        const name =
          dayparts
            .flatMap((d) => d.menuItems)
            .flatMap((m) => m.ingredients)
            .find((i) => i.inventoryItemId === id)?.ingredient ?? "ingredient";
        return `${name} (${qty})`;
      })
      .join(", ");
    insight += ` Use leftover prep from ${carryoverFromDate} first${top ? ` — ${top}` : ""}.`;
  }

  return insight;
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

  const dayparts = buildDaypartsForDate(
    targetDate,
    menuItems,
    dailyMenu,
    dailyCovers,
    invMap,
    fallbackByDaypart
  );

  const yesterday = addDays(startOfDay(targetDate), -1);
  const yesterdayDayparts = buildDaypartsForDate(
    yesterday,
    menuItems,
    dailyMenu,
    dailyCovers,
    invMap,
    fallbackByDaypart
  );
  const yesterdayUsage = computeIngredientUsageForDate(yesterday, orders, menuItems);
  const carryover = computeCarryoverMap(yesterdayDayparts, yesterdayUsage);
  const carryoverFromDate = dateKey(yesterday);

  const dailyMenuItems = mergeDailyMenuItems(
    dayparts.filter((d) => MEAL_DAYPARTS.includes(d.daypart as MealDaypart))
  );
  const totalPrep = buildTotalPrepBlock(dayparts, invMap, carryover, carryoverFromDate);

  const forecastCovers = totalPrep.forecastCovers;

  const menuItemCount = dailyMenuItems.length;
  const ingredientLines = totalPrep.tasks.length;
  const carryoverCount = carryover.size;
  const summary =
    carryoverCount > 0
      ? `${menuItemCount} menu items · ${ingredientLines} ingredient types for ${dayOfWeek} — full-day prep (~${forecastCovers} covers) · ${carryoverCount} with leftover prep from ${carryoverFromDate}`
      : `${menuItemCount} menu items · ${ingredientLines} ingredient types for ${dayOfWeek} — full-day prep totals (~${forecastCovers} covers)`;

  return {
    date: dateKey(targetDate),
    dayOfWeek,
    forecastCovers,
    menuItems: dailyMenuItems,
    totalPrep,
    dayparts,
    tasks: totalPrep.tasks,
    summary,
    aiInsight: buildAiInsight(dayOfWeek, dayparts, forecastCovers, carryover, carryoverFromDate),
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

  const scaleTask = (t: PrepTask): PrepTask => {
    const prepQty = round1(t.prepQty * multiplier);
    const stillNeedQty = Math.max(0, round1(prepQty - t.availableQty));
    return {
      ...t,
      rawQtyNeeded: round1(t.rawQtyNeeded * multiplier),
      sellableQtyNeeded: round1(t.sellableQtyNeeded * multiplier),
      prepQty,
      stillNeedQty,
      priority: stillNeedQty > 0 ? "HIGH" : "NORMAL",
    };
  };

  return {
    ...prepList,
    forecastCovers: Math.round(prepList.forecastCovers * multiplier),
    menuItems: prepList.menuItems.map(scaleMenu),
    totalPrep: {
      ...prepList.totalPrep,
      forecastCovers: Math.round(prepList.totalPrep.forecastCovers * multiplier),
      breakfastCovers: Math.round(prepList.totalPrep.breakfastCovers * multiplier),
      lunchCovers: Math.round(prepList.totalPrep.lunchCovers * multiplier),
      dinnerCovers: Math.round(prepList.totalPrep.dinnerCovers * multiplier),
      tasks: prepList.totalPrep.tasks.map(scaleTask),
    },
    dayparts: prepList.dayparts.map((d) => ({
      ...d,
      forecastCovers: Math.round(d.forecastCovers * multiplier),
      menuItems: d.menuItems.map(scaleMenu),
      tasks: d.tasks.map(scaleTask),
    })),
    tasks: prepList.totalPrep.tasks.map(scaleTask),
    summary: note ? `${prepList.summary} · ${note}` : prepList.summary,
  };
}
