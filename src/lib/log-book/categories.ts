import type { LogBookCategory } from "@prisma/client";

export const LOG_BOOK_CATEGORIES: Array<{
  id: LogBookCategory;
  label: string;
  description: string;
}> = [
  { id: "GENERAL", label: "General", description: "Day overview and notes" },
  { id: "SALES", label: "Sales", description: "Revenue, covers, and pacing" },
  { id: "STAFFING", label: "Staffing", description: "Labor levels, call-outs, coverage" },
  { id: "MAINTENANCE", label: "Maintenance", description: "Equipment and facility issues" },
  { id: "STAFF", label: "Staff", description: "Performance, coaching, incidents" },
  { id: "GUEST", label: "Guest", description: "Complaints, compliments, VIPs" },
  { id: "INVENTORY", label: "Inventory", description: "86s, deliveries, variances" },
  { id: "SAFETY", label: "Safety", description: "Incidents and compliance" },
  { id: "OPERATIONS", label: "Operations", description: "Service flow and handoffs" },
];

export function categoryLabel(category: LogBookCategory): string {
  return LOG_BOOK_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

export function categoryColor(category: LogBookCategory): string {
  const map: Record<LogBookCategory, string> = {
    GENERAL: "bg-slate-100 text-slate-700",
    SALES: "bg-emerald-100 text-emerald-800",
    STAFFING: "bg-blue-100 text-blue-800",
    MAINTENANCE: "bg-amber-100 text-amber-800",
    STAFF: "bg-violet-100 text-violet-800",
    GUEST: "bg-pink-100 text-pink-800",
    INVENTORY: "bg-orange-100 text-orange-800",
    SAFETY: "bg-red-100 text-red-800",
    OPERATIONS: "bg-cyan-100 text-cyan-800",
  };
  return map[category] ?? "bg-slate-100 text-slate-700";
}
