import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { getOrCreateComplianceSettings } from "@/lib/compliance/validate-shift";
import { enrichShiftsWithCompliance } from "@/lib/compliance/enrich-shifts";
import { getWeekStart, getWeekEnd } from "@/lib/schedule";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_compliance");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  await getOrCreateComplianceSettings(locationId);

  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd(weekStart);

  const [settings, shifts, openIncidents, oshaCount, location] = await Promise.all([
    getOrCreateComplianceSettings(locationId),
    prisma.shift.findMany({
      where: { locationId, date: { gte: weekStart, lte: weekEnd } },
      include: { staffMember: { select: { id: true, name: true, dateOfBirth: true } } },
    }),
    prisma.incidentReport.count({ where: { locationId, status: { in: ["OPEN", "INVESTIGATING"] } } }),
    prisma.incidentReport.count({
      where: { locationId, oshaRecordable: true, reportedAt: { gte: new Date(Date.now() - 365 * 86400000) } },
    }),
    prisma.location.findUnique({
      where: { id: locationId },
      select: {
        mealBreakRequiredAfterHours: true,
        mealBreakAlertMinutes: true,
        mealBreakMinutes: true,
      },
    }),
  ]);

  const compliance = await enrichShiftsWithCompliance(locationId, shifts);
  const minorViolations = Object.entries(compliance).flatMap(([shiftId, data]) => {
    const shift = shifts.find((s) => s.id === shiftId);
    return data.violations.map((v) => ({
      shiftId,
      staffName: shift?.staffMember?.name ?? "Unknown",
      shiftDate: shift?.date.toISOString(),
      ...v,
    }));
  });

  const [shiftArchiveCount, timecardCount, payrollRunCount] = await Promise.all([
    prisma.shift.count({ where: { locationId } }),
    prisma.timeEntry.count({ where: { locationId } }),
    prisma.payrollRun.count({ where: { locationId } }),
  ]);

  return NextResponse.json({
    settings,
    breakSettings: location,
    summary: {
      minorViolationsThisWeek: minorViolations.length,
      blockedViolations: minorViolations.filter((v) => v.severity === "block").length,
      openIncidents,
      oshaRecordable12Mo: oshaCount,
      archivedShifts: shiftArchiveCount,
      archivedTimecards: timecardCount,
      archivedPayrollRuns: payrollRunCount,
    },
    minorViolations,
  });
}

export async function PATCH(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_compliance");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  if (
    body.mealBreakRequiredAfterHours != null ||
    body.mealBreakAlertMinutes != null
  ) {
    await prisma.location.update({
      where: { id: locationId },
      data: {
        mealBreakRequiredAfterHours:
          body.mealBreakRequiredAfterHours != null
            ? Number(body.mealBreakRequiredAfterHours)
            : undefined,
        mealBreakAlertMinutes:
          body.mealBreakAlertMinutes != null ? Number(body.mealBreakAlertMinutes) : undefined,
      },
    });
  }

  const settings = await prisma.complianceSettings.upsert({
    where: { locationId },
    create: {
      locationId,
      minorBlockScheduling: body.minorBlockScheduling ?? true,
      minorSchoolNightEndHour: Number(body.minorSchoolNightEndHour) || 22,
      minorSchoolNightDays: body.minorSchoolNightDays ?? "0,1,2,3,4",
      minorMaxWeeklyHoursSchool: Number(body.minorMaxWeeklyHoursSchool) || 18,
      minorMaxDailyHoursSchool: Number(body.minorMaxDailyHoursSchool) || 6,
      schoolCalendarActive: body.schoolCalendarActive ?? true,
      minorBlockTimeClock: body.minorBlockTimeClock ?? true,
      minorAlertMinutesBefore: Number(body.minorAlertMinutesBefore) || 30,
      managerAlertPhone: body.managerAlertPhone ?? null,
      requireTipDeclaration: body.requireTipDeclaration ?? true,
    },
    update: {
      minorBlockScheduling: body.minorBlockScheduling,
      minorSchoolNightEndHour: body.minorSchoolNightEndHour != null ? Number(body.minorSchoolNightEndHour) : undefined,
      minorSchoolNightDays: body.minorSchoolNightDays,
      minorMaxWeeklyHoursSchool:
        body.minorMaxWeeklyHoursSchool != null ? Number(body.minorMaxWeeklyHoursSchool) : undefined,
      minorMaxDailyHoursSchool:
        body.minorMaxDailyHoursSchool != null ? Number(body.minorMaxDailyHoursSchool) : undefined,
      schoolCalendarActive: body.schoolCalendarActive,
      minorBlockTimeClock: body.minorBlockTimeClock,
      minorAlertMinutesBefore:
        body.minorAlertMinutesBefore != null ? Number(body.minorAlertMinutesBefore) : undefined,
      managerAlertPhone: body.managerAlertPhone,
      requireTipDeclaration: body.requireTipDeclaration,
    },
  });

  return NextResponse.json(settings);
}
