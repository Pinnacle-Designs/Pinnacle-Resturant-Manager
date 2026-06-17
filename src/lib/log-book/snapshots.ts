import { prisma } from "@/lib/prisma";
import { startOfBusinessDay, endOfBusinessDay } from "./utils";

export async function computeLogBookDaySnapshot(locationId: string, logDate: Date) {
  const start = startOfBusinessDay(logDate);
  const end = endOfBusinessDay(logDate);

  const [orders, timeEntries, shifts] = await Promise.all([
    prisma.order.findMany({
      where: {
        locationId,
        status: "PAID",
        paidAt: { gte: start, lte: end },
      },
      select: { totalAmount: true, guestCount: true },
    }),
    prisma.timeEntry.findMany({
      where: {
        locationId,
        clockInAt: { lte: end },
        OR: [{ clockOutAt: null }, { clockOutAt: { gte: start } }],
      },
      select: { clockInAt: true, clockOutAt: true, hourlyRateAtPunch: true },
    }),
    prisma.shift.findMany({
      where: { locationId, date: { gte: start, lte: end } },
      select: { id: true },
    }),
  ]);

  const salesTotal = orders.reduce((s, o) => s + o.totalAmount, 0);
  const guestCount = orders.reduce((s, o) => s + (o.guestCount || 0), 0);

  let laborHours = 0;
  let laborCost = 0;
  const now = new Date();
  for (const entry of timeEntries) {
    const inAt = entry.clockInAt < start ? start : entry.clockInAt;
    const outAt = entry.clockOutAt ? (entry.clockOutAt > end ? end : entry.clockOutAt) : now > end ? end : now;
    if (outAt <= inAt) continue;
    const hours = (outAt.getTime() - inAt.getTime()) / 3600000;
    laborHours += hours;
    laborCost += hours * (entry.hourlyRateAtPunch ?? 0);
  }

  return {
    salesTotal: Math.round(salesTotal * 100) / 100,
    guestCount,
    laborHours: Math.round(laborHours * 10) / 10,
    laborCost: Math.round(laborCost * 100) / 100,
    scheduledShifts: shifts.length,
    orderCount: orders.length,
  };
}
