import { differenceInMinutes } from "date-fns";
import {
  isMinor,
  isSchoolNight,
  parseSchoolNightDays,
  type ComplianceSettingsLike,
  type MinorViolation,
} from "./minor-labor";

export type TimeClockComplianceSettings = ComplianceSettingsLike & {
  minorBlockTimeClock?: boolean;
  minorAlertMinutesBefore?: number;
};

function formatHour(h: number): string {
  const hour = h % 24;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

function minutesUntilCurfew(now: Date, settings: ComplianceSettingsLike): number | null {
  if (!isSchoolNight(now, settings)) return null;
  const curfewMins = settings.minorSchoolNightEndHour * 60;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return curfewMins - nowMins;
}

/** Block clock-in if minor would still be on clock past curfew on a school night. */
export function checkMinorClockIn(params: {
  dateOfBirth: Date | null | undefined;
  now?: Date;
  settings: TimeClockComplianceSettings;
}): MinorViolation[] {
  const now = params.now ?? new Date();
  if (!isMinor(params.dateOfBirth, now)) return [];
  if (!params.settings.minorBlockTimeClock && !params.settings.minorBlockScheduling) return [];

  const violations: MinorViolation[] = [];
  const block = Boolean(params.settings.minorBlockTimeClock ?? params.settings.minorBlockScheduling);

  if (isSchoolNight(now, params.settings)) {
    const minsToCurfew = minutesUntilCurfew(now, params.settings);
    if (minsToCurfew !== null && minsToCurfew <= 0) {
      violations.push({
        code: "MINOR_CURFEW_ACTIVE",
        severity: block ? "block" : "warn",
        message: `Minor cannot clock in — school-night curfew is ${formatHour(params.settings.minorSchoolNightEndHour)}.`,
      });
    }
  }

  return violations;
}

/** Block clock-out continuation / warn if minor is past curfew while still clocked in. */
export function checkMinorWhileClockedIn(params: {
  dateOfBirth: Date | null | undefined;
  clockInAt: Date;
  now?: Date;
  settings: TimeClockComplianceSettings;
}): MinorViolation[] {
  const now = params.now ?? new Date();
  if (!isMinor(params.dateOfBirth, now)) return [];
  if (!params.settings.minorBlockTimeClock && !params.settings.minorBlockScheduling) return [];

  const violations: MinorViolation[] = [];
  const block = Boolean(params.settings.minorBlockTimeClock ?? params.settings.minorBlockScheduling);

  if (isSchoolNight(now, params.settings)) {
    const curfew = new Date(now);
    curfew.setHours(params.settings.minorSchoolNightEndHour, 0, 0, 0);
    if (now >= curfew) {
      violations.push({
        code: "MINOR_PAST_CURFEW",
        severity: block ? "block" : "warn",
        message: `Minor must clock out — past ${formatHour(params.settings.minorSchoolNightEndHour)} school-night curfew.`,
      });
    }

    const dailyHours = differenceInMinutes(now, params.clockInAt) / 60;
    if (dailyHours > params.settings.minorMaxDailyHoursSchool) {
      violations.push({
        code: "MINOR_DAILY_HOURS",
        severity: block ? "block" : "warn",
        message: `Minor has ${dailyHours.toFixed(1)}h on clock — max ${params.settings.minorMaxDailyHoursSchool}h per school day.`,
      });
    }
  }

  return violations;
}

export function getMinorApproachingViolation(params: {
  dateOfBirth: Date | null | undefined;
  clockInAt: Date | null;
  now?: Date;
  settings: TimeClockComplianceSettings;
}): {
  staffWouldViolate: boolean;
  minutesUntilViolation: number;
  message: string;
  code: string;
} | null {
  const now = params.now ?? new Date();
  if (!isMinor(params.dateOfBirth, now)) return null;

  const alertWindow = params.settings.minorAlertMinutesBefore ?? 30;

  if (params.clockInAt && isSchoolNight(now, params.settings)) {
    const curfew = new Date(now);
    curfew.setHours(params.settings.minorSchoolNightEndHour, 0, 0, 0);
    const minsToCurfew = differenceInMinutes(curfew, now);
    if (minsToCurfew <= alertWindow && minsToCurfew >= -5) {
      return {
        code: "MINOR_CURFEW_APPROACHING",
        minutesUntilViolation: minsToCurfew,
        staffWouldViolate: minsToCurfew <= 0,
        message:
          minsToCurfew <= 0
            ? `Minor is past ${formatHour(params.settings.minorSchoolNightEndHour)} school-night curfew.`
            : `Minor must clock out in ${minsToCurfew} min (curfew ${formatHour(params.settings.minorSchoolNightEndHour)}).`,
      };
    }

    const dailyHours = differenceInMinutes(now, params.clockInAt) / 60;
    const minsUntilDailyLimit = Math.round(
      (params.settings.minorMaxDailyHoursSchool - dailyHours) * 60
    );
    if (minsUntilDailyLimit <= alertWindow && minsUntilDailyLimit >= -5) {
      return {
        code: "MINOR_DAILY_HOURS_APPROACHING",
        minutesUntilViolation: minsUntilDailyLimit,
        staffWouldViolate: minsUntilDailyLimit <= 0,
        message:
          minsUntilDailyLimit <= 0
            ? `Minor exceeded ${params.settings.minorMaxDailyHoursSchool}h daily limit.`
            : `Minor hits ${params.settings.minorMaxDailyHoursSchool}h daily limit in ${minsUntilDailyLimit} min.`,
      };
    }
  }

  if (!params.clockInAt && isSchoolNight(now, params.settings)) {
    const minsToCurfew = minutesUntilCurfew(now, params.settings);
    if (minsToCurfew !== null && minsToCurfew <= alertWindow && minsToCurfew > 0) {
      return {
        code: "MINOR_CURFEW_SOON",
        minutesUntilViolation: minsToCurfew,
        staffWouldViolate: false,
        message: `School-night curfew ${formatHour(params.settings.minorSchoolNightEndHour)} in ${minsToCurfew} min — do not schedule minors past curfew.`,
      };
    }
  }

  return null;
}

export function schoolNightDayLabels(settings: ComplianceSettingsLike): string {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return parseSchoolNightDays(settings.minorSchoolNightDays)
    .map((d) => labels[d] ?? String(d))
    .join(", ");
}
