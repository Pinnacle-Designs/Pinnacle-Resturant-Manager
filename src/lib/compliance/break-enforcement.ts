import { differenceInMinutes } from "date-fns";

export type BreakLocationSettings = {
  mealBreakMinutes: number;
  mealBreakRequiredAfterHours: number;
  mealBreakAlertMinutes: number;
};

export const BREAK_WAIVER_TEXT =
  "I voluntarily declined my required meal break and understand I may waive it only if my employer provides this option under applicable law.";

/** When the meal break must start (clock-in + required hours). */
export function getMealBreakDueAt(clockInAt: Date, requiredAfterHours: number): Date {
  return new Date(clockInAt.getTime() + requiredAfterHours * 60 * 60 * 1000);
}

export function hoursOnClock(clockInAt: Date, now = new Date()): number {
  return differenceInMinutes(now, clockInAt) / 60;
}

export function isMealBreakRequired(
  clockInAt: Date,
  settings: Pick<BreakLocationSettings, "mealBreakRequiredAfterHours">,
  now = new Date()
): boolean {
  return hoursOnClock(clockInAt, now) >= settings.mealBreakRequiredAfterHours;
}

export function minutesUntilMealBreakDue(
  clockInAt: Date,
  settings: Pick<BreakLocationSettings, "mealBreakRequiredAfterHours">,
  now = new Date()
): number {
  const dueAt = getMealBreakDueAt(clockInAt, settings.mealBreakRequiredAfterHours);
  return Math.round((dueAt.getTime() - now.getTime()) / 60000);
}

/** Manager alert window: within alertMinutes before break is due, and break not yet overdue by more than 30 min. */
export function isMealBreakAlertDue(
  clockInAt: Date,
  settings: BreakLocationSettings,
  now = new Date()
): boolean {
  const mins = minutesUntilMealBreakDue(clockInAt, settings, now);
  return mins <= settings.mealBreakAlertMinutes && mins >= -30;
}

export function needsBreakWaiver(
  mealBreakTaken: boolean,
  clockInAt: Date,
  settings: Pick<BreakLocationSettings, "mealBreakRequiredAfterHours">,
  now = new Date()
): boolean {
  return !mealBreakTaken && isMealBreakRequired(clockInAt, settings, now);
}

export function formatMealBreakDueLabel(
  clockInAt: Date,
  settings: Pick<BreakLocationSettings, "mealBreakRequiredAfterHours">,
  now = new Date()
): string {
  const mins = minutesUntilMealBreakDue(clockInAt, settings, now);
  if (mins <= 0) return `${Math.abs(mins)} min overdue`;
  if (mins < 60) return `due in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `due in ${h}h ${m}m` : `due in ${h}h`;
}
