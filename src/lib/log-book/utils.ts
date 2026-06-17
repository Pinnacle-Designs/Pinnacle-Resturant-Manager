import type { LogBookCategory } from "@prisma/client";

export function buildLogBookSearchText(parts: {
  title?: string | null;
  content: string;
  authorName: string;
  category: LogBookCategory;
  staffingNote?: string | null;
  maintenanceNote?: string | null;
  mentionLabels?: string[];
}): string {
  return [
    parts.title,
    parts.content,
    parts.authorName,
    parts.category,
    parts.staffingNote,
    parts.maintenanceNote,
    ...(parts.mentionLabels ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function startOfBusinessDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfBusinessDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatLogDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function toDateInputValue(date: Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
