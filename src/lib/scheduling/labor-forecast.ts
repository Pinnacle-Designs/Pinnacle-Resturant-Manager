import { format, getDay, startOfDay, subWeeks } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getWeekDays, shiftDurationHours } from "@/lib/schedule";

const DEFAULT_SALES_PER_LABOR_HOUR = 100;

export interface DayLaborForecast {
  date: string;
  dayLabel: string;
  predictedSales: number;
  scheduledHours: number;
  scheduledLaborCost: number;
  recommendedHours: number;
  laborPct: number;
  targetLaborPct: number;
  status: "under" | "on_target" | "over";
  gapHours: number;
}

export interface WeekLaborSummary {
  weekStart: string;
  weekEnd: string;
  predictedSales: number;
  scheduledHours: number;
  scheduledLaborCost: number;
  laborPct: number;
  targetLaborPct: number;
  recommendedHours: number;
  gapHours: number;
  days: DayLaborForecast[];
}

function dayOfWeekSales(
  orders: { createdAt: Date; totalAmount: number }[],
  dow: number
): number[] {
  const totals: number[] = [];
  const byWeek = new Map<string, number>();

  for (const o of orders) {
    if (getDay(o.createdAt) !== dow) continue;
    const weekKey = format(startOfDay(subWeeks(o.createdAt, 0)), "yyyy-'W'ww");
    const key = `${format(o.createdAt, "yyyy-MM-dd")}`;
    void weekKey;
    byWeek.set(key, (byWeek.get(key) ?? 0) + o.totalAmount);
  }

  const dailyTotals = new Map<string, number>();
  for (const o of orders) {
    if (getDay(o.createdAt) !== dow) continue;
    const key = format(o.createdAt, "yyyy-MM-dd");
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + o.totalAmount);
  }

  for (const v of dailyTotals.values()) totals.push(v);
  return totals;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export async function computeWeekLaborForecast(
  locationId: string,
  weekStart: Date
): Promise<WeekLaborSummary> {
  const weekDays = getWeekDays(weekStart);
  const weekEnd = weekDays[6];
  const lookbackStart = subWeeks(weekStart, 8);

  const [location, orders, shifts] = await Promise.all([
    prisma.location.findUnique({
      where: { id: locationId },
      select: {
        targetLaborPct: true,
        seatCount: true,
      },
    }),
    prisma.order.findMany({
      where: {
        locationId,
        status: "PAID",
        createdAt: { gte: lookbackStart, lt: weekStart },
      },
      select: { createdAt: true, totalAmount: true, discountAmount: true, compAmount: true, voidAmount: true },
    }),
    prisma.shift.findMany({
      where: {
        locationId,
        date: { gte: weekStart, lte: weekEnd },
      },
      include: { staffMember: true },
    }),
  ]);

  const targetLaborPct = location?.targetLaborPct ?? 30;
  const netOrders = orders.map((o) => ({
    createdAt: o.createdAt,
    totalAmount: o.totalAmount - o.discountAmount - o.compAmount - o.voidAmount,
  }));

  const days: DayLaborForecast[] = weekDays.map((day) => {
    const dow = getDay(day);
    const historical = dayOfWeekSales(netOrders, dow);
    const predictedSales =
      historical.length > 0
        ? avg(historical)
        : (location?.seatCount ?? 40) * 18;

    const dayShifts = shifts.filter(
      (s) => format(s.date, "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
    );
    const scheduledHours = dayShifts.reduce(
      (sum, s) => sum + shiftDurationHours(s.startTime, s.endTime),
      0
    );
    const scheduledLaborCost = dayShifts.reduce((sum, s) => {
      const rate = s.staffMember?.hourlyRate ?? 0;
      return sum + shiftDurationHours(s.startTime, s.endTime) * rate;
    }, 0);

    const recommendedHours =
      predictedSales > 0
        ? predictedSales / DEFAULT_SALES_PER_LABOR_HOUR
        : Math.max(scheduledHours, 4);

    const recHours = recommendedHours;

    const laborPct =
      predictedSales > 0 ? (scheduledLaborCost / predictedSales) * 100 : 0;
    const gapHours = recHours - scheduledHours;

    let status: DayLaborForecast["status"] = "on_target";
    if (gapHours > 2) status = "under";
    else if (gapHours < -2) status = "over";

    return {
      date: format(day, "yyyy-MM-dd"),
      dayLabel: format(day, "EEE M/d"),
      predictedSales: Math.round(predictedSales * 100) / 100,
      scheduledHours: Math.round(scheduledHours * 10) / 10,
      scheduledLaborCost: Math.round(scheduledLaborCost * 100) / 100,
      recommendedHours: Math.round(recHours * 10) / 10,
      laborPct: Math.round(laborPct * 10) / 10,
      targetLaborPct,
      status,
      gapHours: Math.round(gapHours * 10) / 10,
    };
  });

  const predictedSales = days.reduce((s, d) => s + d.predictedSales, 0);
  const scheduledHours = days.reduce((s, d) => s + d.scheduledHours, 0);
  const scheduledLaborCost = days.reduce((s, d) => s + d.scheduledLaborCost, 0);
  const recommendedHours = days.reduce((s, d) => s + d.recommendedHours, 0);
  const laborPct =
    predictedSales > 0 ? (scheduledLaborCost / predictedSales) * 100 : 0;

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    predictedSales: Math.round(predictedSales * 100) / 100,
    scheduledHours: Math.round(scheduledHours * 10) / 10,
    scheduledLaborCost: Math.round(scheduledLaborCost * 100) / 100,
    laborPct: Math.round(laborPct * 10) / 10,
    targetLaborPct,
    recommendedHours: Math.round(recommendedHours * 10) / 10,
    gapHours: Math.round((recommendedHours - scheduledHours) * 10) / 10,
    days,
  };
}
