import { prisma } from "@/lib/prisma";
import { getOrCreateComplianceSettings } from "./validate-shift";
import {
  formatMealBreakDueLabel,
  isMealBreakAlertDue,
  type BreakLocationSettings,
} from "./break-enforcement";
import { getMinorApproachingViolation } from "./minor-timeclock";
import { notifyManagerCompliance } from "./notify-manager";

export type MealBreakAlert = {
  type: "meal_break_due";
  entryId: string;
  staffMemberId: string;
  staffName: string;
  clockInAt: string;
  dueLabel: string;
  minutesUntilDue: number;
  overdue: boolean;
};

export type MinorComplianceAlert = {
  type: "minor_violation";
  staffMemberId: string;
  staffName: string;
  code: string;
  message: string;
  minutesUntilViolation: number;
  clockedIn: boolean;
};

export type BreakWaiverAlert = {
  type: "break_waiver";
  entryId: string;
  staffName: string;
  clockOutAt: string;
  waived: boolean;
};

export type ComplianceAlertsPayload = {
  mealBreakAlerts: MealBreakAlert[];
  minorAlerts: MinorComplianceAlert[];
  recentBreakWaivers: BreakWaiverAlert[];
  settings: {
    mealBreakAlertMinutes: number;
    mealBreakRequiredAfterHours: number;
    minorAlertMinutesBefore: number;
    requireTipDeclaration: boolean;
  };
};

export async function getComplianceAlerts(locationId: string): Promise<ComplianceAlertsPayload> {
  const [location, compliance, openEntries, recentWaivers, staffMembers] = await Promise.all([
    prisma.location.findUnique({
      where: { id: locationId },
      select: {
        mealBreakMinutes: true,
        mealBreakRequiredAfterHours: true,
        mealBreakAlertMinutes: true,
      },
    }),
    getOrCreateComplianceSettings(locationId),
    prisma.timeEntry.findMany({
      where: { locationId, clockOutAt: null },
      include: { staffMember: { select: { id: true, name: true, dateOfBirth: true } } },
    }),
    prisma.timeEntry.findMany({
      where: {
        locationId,
        mealBreakWaived: true,
        clockOutAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      include: { staffMember: { select: { name: true } } },
      orderBy: { clockOutAt: "desc" },
      take: 10,
    }),
    prisma.staffMember.findMany({
      where: { locationId, active: true },
      select: { id: true, name: true, dateOfBirth: true },
    }),
  ]);

  const breakSettings: BreakLocationSettings = {
    mealBreakMinutes: location?.mealBreakMinutes ?? 30,
    mealBreakRequiredAfterHours: location?.mealBreakRequiredAfterHours ?? 5,
    mealBreakAlertMinutes: location?.mealBreakAlertMinutes ?? 15,
  };

  const now = new Date();
  const mealBreakAlerts: MealBreakAlert[] = [];

  for (const entry of openEntries) {
    if (!isMealBreakAlertDue(entry.clockInAt, breakSettings, now)) continue;
    const mins = Math.round(
      (entry.clockInAt.getTime() +
        breakSettings.mealBreakRequiredAfterHours * 3600000 -
        now.getTime()) /
        60000
    );
    mealBreakAlerts.push({
      type: "meal_break_due",
      entryId: entry.id,
      staffMemberId: entry.staffMemberId,
      staffName: entry.staffMember.name,
      clockInAt: entry.clockInAt.toISOString(),
      dueLabel: formatMealBreakDueLabel(entry.clockInAt, breakSettings, now),
      minutesUntilDue: mins,
      overdue: mins <= 0,
    });

    if (mins <= breakSettings.mealBreakAlertMinutes && mins > 0) {
      void notifyManagerCompliance({
        locationId,
        staffName: entry.staffMember.name,
        alertCode: "MEAL_BREAK_DUE",
        message: `Meal break due in ${mins} min (clocked in ${entry.clockInAt.toLocaleTimeString()}).`,
      });
    }
  }

  const openByStaff = new Map(openEntries.map((e) => [e.staffMemberId, e]));
  const minorAlerts: MinorComplianceAlert[] = [];

  for (const staff of staffMembers) {
    const open = openByStaff.get(staff.id);
    const approaching = getMinorApproachingViolation({
      dateOfBirth: staff.dateOfBirth,
      clockInAt: open?.clockInAt ?? null,
      settings: compliance,
    });
    if (!approaching) continue;

    minorAlerts.push({
      type: "minor_violation",
      staffMemberId: staff.id,
      staffName: staff.name,
      code: approaching.code,
      message: approaching.message,
      minutesUntilViolation: approaching.minutesUntilViolation,
      clockedIn: Boolean(open),
    });

    if (approaching.minutesUntilViolation <= (compliance.minorAlertMinutesBefore ?? 30)) {
      void notifyManagerCompliance({
        locationId,
        staffName: staff.name,
        alertCode: approaching.code,
        message: approaching.message,
      });
    }
  }

  return {
    mealBreakAlerts,
    minorAlerts,
    recentBreakWaivers: recentWaivers.map((e) => ({
      type: "break_waiver" as const,
      entryId: e.id,
      staffName: e.staffMember.name,
      clockOutAt: e.clockOutAt?.toISOString() ?? "",
      waived: e.mealBreakWaived,
    })),
    settings: {
      mealBreakAlertMinutes: breakSettings.mealBreakAlertMinutes,
      mealBreakRequiredAfterHours: breakSettings.mealBreakRequiredAfterHours,
      minorAlertMinutesBefore: compliance.minorAlertMinutesBefore ?? 30,
      requireTipDeclaration: compliance.requireTipDeclaration ?? true,
    },
  };
}
