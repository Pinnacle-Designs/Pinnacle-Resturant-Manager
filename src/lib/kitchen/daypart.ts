/** Meal periods for prep forecasting — shared client/server. */

export const MEAL_DAYPARTS = ["breakfast", "lunch", "dinner"] as const;
export type MealDaypart = (typeof MEAL_DAYPARTS)[number];
export type Daypart = MealDaypart | "late";

export const DAYPART_LABELS: Record<Daypart, string> = {
  breakfast: "Breakfast (5am–11am)",
  lunch: "Lunch (11am–3pm)",
  dinner: "Dinner (3pm–10pm)",
  late: "Late night (10pm–5am)",
};

export const DAYPART_SHORT: Record<Daypart, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  late: "Late",
};

export const DAY_OF_WEEK_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function daypartFromHour(hour: number): Daypart {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 22) return "dinner";
  return "late";
}

export function dayOfWeekName(dow: number): string {
  return DAY_OF_WEEK_NAMES[dow] ?? "Unknown";
}
