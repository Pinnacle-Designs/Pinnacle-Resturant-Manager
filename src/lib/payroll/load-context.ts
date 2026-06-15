import { prisma } from "@/lib/prisma";
import {
  computePayrollPreview,
  settingsFromDb,
  defaultPayrollSettings,
  parseTipPoolRoles,
} from "./compute";
import type { PayrollPreview } from "./types";

export async function getOrCreatePayrollSettings(locationId: string) {
  let settings = await prisma.payrollSettings.findUnique({ where: { locationId } });
  if (!settings) {
    const defaults = defaultPayrollSettings();
    settings = await prisma.payrollSettings.create({
      data: {
        locationId,
        ...defaults,
        tipPoolRoles: null,
      },
    });
  }
  return settings;
}

export async function loadPayrollPreview(
  locationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<PayrollPreview> {
  const [settingsRow, staff, roleRates, shifts, orders] = await Promise.all([
    getOrCreatePayrollSettings(locationId),
    prisma.staffMember.findMany({ where: { locationId } }),
    prisma.staffRoleRate.findMany({
      where: { staffMember: { locationId } },
    }),
    prisma.shift.findMany({
      where: {
        locationId,
        date: { gte: periodStart, lte: periodEnd },
      },
    }),
    prisma.order.findMany({
      where: {
        locationId,
        paidAt: { gte: periodStart, lte: periodEnd },
        status: { in: ["PAID", "SERVED"] },
      },
      include: { payments: true },
    }),
  ]);

  const settings = settingsFromDb(settingsRow);

  const tipOrders = orders.flatMap((order) => {
    const tips = order.payments.reduce((s, p) => s + p.tipAmount, 0);
    if (tips <= 0) return [];
    return [
      {
        serverStaffId: order.serverStaffId,
        tipAmount: tips,
        paidAt: order.paidAt,
      },
    ];
  });

  return computePayrollPreview(
    staff.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      hourlyRate: s.hourlyRate,
      isTippedEmployee: s.isTippedEmployee,
      tipPoints: s.tipPoints,
      active: s.active,
    })),
    shifts.map((sh) => ({
      id: sh.id,
      staffMemberId: sh.staffMemberId,
      date: sh.date,
      startTime: sh.startTime,
      endTime: sh.endTime,
      workRole: sh.workRole,
    })),
    roleRates.map((r) => ({
      staffMemberId: r.staffMemberId,
      role: r.role,
      hourlyRate: r.hourlyRate,
      tipPoints: r.tipPoints,
      isTippedRole: r.isTippedRole,
    })),
    tipOrders,
    settings,
    periodStart,
    periodEnd
  );
}

export { parseTipPoolRoles };
