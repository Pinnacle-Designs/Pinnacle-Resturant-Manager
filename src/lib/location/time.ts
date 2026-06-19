/** Calendar date YYYY-MM-DD in the location's timezone. */
export function dateKeyInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Hour 0–23 in the location's timezone. */
export function getHourInTimezone(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).format(date);
  return parseInt(hour, 10) % 24;
}

/** Day of week 0=Sun … 6=Sat in the location's timezone. */
export function getDayInTimezone(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? date.getDay();
}

/** Noon anchor for a calendar day in location TZ (matches weather/holiday factor dates). */
export function startOfDayInTimezone(date: Date, timeZone: string): Date {
  const key = dateKeyInTimezone(date, timeZone);
  return new Date(`${key}T12:00:00`);
}

export function formatLocalTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function locationNowLabel(timeZone: string | null | undefined): string | null {
  if (!timeZone) return null;
  return formatLocalTime(new Date(), timeZone);
}

/** Pick hour from order timestamp using location TZ when available. */
export function orderHour(createdAt: Date, timeZone?: string | null): number {
  return timeZone ? getHourInTimezone(createdAt, timeZone) : createdAt.getHours();
}
