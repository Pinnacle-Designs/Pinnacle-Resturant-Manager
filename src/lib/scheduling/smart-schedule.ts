import { prisma } from "@/lib/prisma";
import { computeWeekLaborForecast } from "./labor-forecast";
import { SHIFT_PRESETS } from "@/lib/schedule";

export interface ScheduleSuggestion {
  date: string;
  dayLabel: string;
  workRole: string;
  startTime: string;
  endTime: string;
  reason: string;
  priority: "high" | "medium";
}

export async function generateScheduleSuggestions(
  locationId: string,
  weekStart: Date
): Promise<ScheduleSuggestion[]> {
  const forecast = await computeWeekLaborForecast(locationId, weekStart);
  const staff = await prisma.staffMember.findMany({
    where: { locationId, active: true },
    orderBy: { name: "asc" },
  });

  const suggestions: ScheduleSuggestion[] = [];

  for (const day of forecast.days) {
    if (day.status !== "under" || day.gapHours <= 0) continue;

    const understaffedHours = day.gapHours;
    const preset =
      understaffedHours >= 7
        ? SHIFT_PRESETS.find((p) => p.label === "Day")!
        : understaffedHours >= 5
          ? SHIFT_PRESETS.find((p) => p.label === "Swing")!
          : SHIFT_PRESETS.find((p) => p.label === "Evening")!;

    const roleCounts = new Map<string, number>();
    for (const s of staff) {
      roleCounts.set(s.role, (roleCounts.get(s.role) ?? 0) + 1);
    }
    const topRole =
      [...roleCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Server";

    suggestions.push({
      date: day.date,
      dayLabel: day.dayLabel,
      workRole: topRole,
      startTime: preset.startTime,
      endTime: preset.endTime,
      reason: `Forecast ${day.laborPct}% labor vs ${day.targetLaborPct}% target — add ~${day.gapHours.toFixed(1)}h coverage`,
      priority: day.gapHours >= 6 ? "high" : "medium",
    });
  }

  return suggestions;
}
