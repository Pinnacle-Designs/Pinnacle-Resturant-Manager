import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  addDays,
  format,
  parseISO,
} from "date-fns";

export { addWeeks };

export const WEEK_STARTS_ON = 1 as const; // Monday

export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
}

export function getWeekEnd(weekStart: Date): Date {
  return endOfWeek(weekStart, { weekStartsOn: WEEK_STARTS_ON });
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  return `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
}

export function toDateKey(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "yyyy-MM-dd");
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function shiftDurationHours(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  let end = parseTimeToMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

export function formatShiftTime(startTime: string, endTime: string): string {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return m ? `${hour}:${String(m).padStart(2, "0")} ${period}` : `${hour} ${period}`;
  };
  return `${fmt(startTime)} – ${fmt(endTime)}`;
}

export function addWeeksToDate(weekStart: Date, weeks: number): Date {
  return addWeeks(weekStart, weeks);
}

export const ROLE_COLORS: Record<string, string> = {
  "Head Chef": "bg-red-100 text-red-800 border-red-200",
  "Sous Chef": "bg-orange-100 text-orange-800 border-orange-200",
  Server: "bg-blue-100 text-blue-800 border-blue-200",
  Bartender: "bg-purple-100 text-purple-800 border-purple-200",
  Host: "bg-pink-100 text-pink-800 border-pink-200",
  Manager: "bg-slate-100 text-slate-800 border-slate-200",
  Busser: "bg-teal-100 text-teal-800 border-teal-200",
  Dishwasher: "bg-gray-100 text-gray-800 border-gray-200",
};

export function roleColor(role: string): string {
  return ROLE_COLORS[role] || "bg-orange-50 text-orange-800 border-orange-200";
}

export const SHIFT_PRESETS = [
  { label: "Morning", startTime: "06:00", endTime: "14:00" },
  { label: "Day", startTime: "09:00", endTime: "17:00" },
  { label: "Swing", startTime: "12:00", endTime: "20:00" },
  { label: "Evening", startTime: "16:00", endTime: "23:00" },
  { label: "Closing", startTime: "17:00", endTime: "01:00" },
];
