"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { WeekLaborSummary } from "@/lib/scheduling/labor-forecast";
import { apiPost } from "@/lib/api";

interface LaborForecastPanelProps {
  weekStart: Date;
  staff: { id: string; name: string }[];
  onShiftAdded: () => void;
}

export function LaborForecastPanel({ weekStart, staff, onShiftAdded }: LaborForecastPanelProps) {
  const [forecast, setForecast] = useState<WeekLaborSummary | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{
      date: string;
      dayLabel: string;
      workRole: string;
      startTime: string;
      endTime: string;
      reason: string;
      priority: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const qs = `weekStart=${weekStart.toISOString()}`;
    Promise.all([
      fetch(`/api/schedule/labor?${qs}`).then((r) => r.json()),
      fetch(`/api/schedule/suggestions?${qs}`).then((r) => r.json()),
    ])
      .then(([labor, sug]) => {
        setForecast(labor);
        setSuggestions(sug.suggestions || []);
      })
      .finally(() => setLoading(false));
  }, [weekStart]);

  const applySuggestion = async (s: (typeof suggestions)[0]) => {
    const member = staff[0];
    if (!member) return;
    setApplying(s.date + s.startTime);
    try {
      await apiPost("/api/schedule", {
        staffMemberId: member.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        workRole: s.workRole,
        notes: "Smart schedule suggestion",
      });
      onShiftAdded();
    } catch {
      alert("Could not add shift");
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading labor forecast…
      </div>
    );
  }

  if (!forecast) return null;

  const overTarget = forecast.laborPct > forecast.targetLaborPct + 2;
  const underTarget = forecast.laborPct < forecast.targetLaborPct - 2;

  return (
    <div className="mb-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Labor % of sales</p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold",
              overTarget ? "text-red-600" : underTarget ? "text-amber-600" : "text-green-600"
            )}
          >
            {forecast.laborPct.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500">Target {forecast.targetLaborPct}%</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Forecast sales</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            ${forecast.predictedSales.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500">Based on 8-week history</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Scheduled hours</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{forecast.scheduledHours}h</p>
          <p className="text-xs text-slate-500">
            Labor cost ${forecast.scheduledLaborCost.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Coverage gap</p>
          <p className="mt-1 flex items-center gap-1 text-2xl font-bold text-slate-900">
            {forecast.gapHours > 0 ? (
              <TrendingUp className="h-5 w-5 text-amber-500" />
            ) : forecast.gapHours < -2 ? (
              <TrendingDown className="h-5 w-5 text-red-500" />
            ) : null}
            {forecast.gapHours > 0 ? "+" : ""}
            {forecast.gapHours}h
          </p>
          <p className="text-xs text-slate-500">vs demand forecast</p>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-600" />
            <p className="text-sm font-semibold text-slate-900">Smart scheduling suggestions</p>
          </div>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={`${s.date}-${s.startTime}`}
                className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <span className="font-medium">{s.dayLabel}</span>
                  <span className="text-slate-500">
                    {" "}
                    · {s.workRole} {s.startTime}–{s.endTime}
                  </span>
                  <p className="text-xs text-slate-500">{s.reason}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!applying}
                  onClick={() => applySuggestion(s)}
                >
                  {applying === s.date + s.startTime ? "Adding…" : "Add shift"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
