"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, CloudRain, Sun, Calendar, TrendingUp } from "lucide-react";
import { Button, Badge, StatCard } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

type Tab = "overlay" | "prep" | "par" | "trends";

export function CrystalBallClient() {
  const [tab, setTab] = useState<Tab>("overlay");
  const [data, setData] = useState<{
    overlay: {
      weatherSource: string;
      geoLabel: string | null;
      learnedPatternCount: number;
      upcomingEvents: Array<{ date: string; description: string; impactPct: number }>;
      dailyOverlays: Array<{
        date: string;
        condition: string;
        precipitationPct: number;
        isRainy: boolean;
        salesMultiplier: number;
        prepMultiplier: number;
        parMultiplier: number;
        drivers: string[];
      }>;
      summary: string;
    };
    microTrends: Array<{
      id: string;
      itemName: string;
      category: string;
      trigger: string;
      impactPct: number;
      confidence: "low" | "medium" | "high";
      action: string;
      sampleSize: number;
    }>;
    adjustedPrep: {
      date: string;
      forecastCovers: number;
      summary: string;
      tasks: Array<{
        ingredient: string;
        unit: string;
        rawQtyNeeded: number;
        prepQty: number;
        priority: string;
        overlayNote?: string;
      }>;
      overlay?: { condition: string; drivers: string[] };
    };
    adjustedPar: Array<{
      name: string;
      vendor: string;
      suggestedQty: number;
      unit: string;
      lineTotal: number;
      reason: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crystal-ball");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overlay", label: "7-Day Overlay" },
    { id: "prep", label: "Adjusted Prep" },
    { id: "par", label: "Par Levels" },
    { id: "trends", label: "Micro-Trends" },
  ];

  const tomorrow = data?.overlay.dailyOverlays[0];
  const rainyDays = data?.overlay.dailyOverlays.filter((d) => d.isRainy).length ?? 0;
  const topTrend = data?.microTrends[0];

  const confidenceColor = {
    high: "bg-emerald-100 text-emerald-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-slate-100 text-slate-600",
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{data?.overlay.summary ?? "Loading forecast overlay…"}</p>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tomorrow multiplier"
          value={tomorrow ? `×${tomorrow.prepMultiplier}` : "—"}
          subtext={tomorrow?.condition}
        />
        <StatCard
          label="Rain days (7d)"
          value={String(rainyDays)}
          subtext={data?.overlay.geoLabel ?? data?.overlay.weatherSource}
        />
        <StatCard
          label="Learned patterns"
          value={String(data?.overlay.learnedPatternCount ?? "—")}
          subtext="From weather & events"
        />
        <StatCard
          label="Top micro-trend"
          value={topTrend ? `${topTrend.impactPct > 0 ? "+" : ""}${topTrend.impactPct}%` : "—"}
          subtext={topTrend?.itemName}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Reading the crystal ball…
        </div>
      ) : null}

      {data && tab === "overlay" ? (
        <div className="space-y-6">
          {data.overlay.upcomingEvents.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Calendar className="h-4 w-4" />
                Upcoming events
              </h3>
              <ul className="space-y-2">
                {data.overlay.upcomingEvents.map((e) => (
                  <li key={e.date + e.description} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-slate-500">{e.date}</span>
                    <span>{e.description}</span>
                    <Badge className="bg-violet-100 text-violet-800">+{e.impactPct}%</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3">Sales</th>
                  <th className="px-4 py-3">Prep</th>
                  <th className="px-4 py-3">Par</th>
                  <th className="px-4 py-3">Drivers</th>
                </tr>
              </thead>
              <tbody>
                {data.overlay.dailyOverlays.map((day) => (
                  <tr key={day.date} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono">{day.date}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {day.isRainy ? (
                          <CloudRain className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Sun className="h-4 w-4 text-amber-500" />
                        )}
                        {day.condition}
                        {day.precipitationPct > 0 ? ` (${day.precipitationPct}%)` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">×{day.salesMultiplier}</td>
                    <td className="px-4 py-3">×{day.prepMultiplier}</td>
                    <td className="px-4 py-3">×{day.parMultiplier}</td>
                    <td className="px-4 py-3 text-slate-600">{day.drivers.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {data && tab === "prep" ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{data.adjustedPrep.summary}</p>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ingredient</th>
                  <th className="px-4 py-3">Prep qty</th>
                  <th className="px-4 py-3">Raw needed</th>
                  <th className="px-4 py-3">Priority</th>
                </tr>
              </thead>
              <tbody>
                {data.adjustedPrep.tasks.slice(0, 20).map((t) => (
                  <tr key={t.ingredient} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{t.ingredient}</td>
                    <td className="px-4 py-3">
                      {t.prepQty} {t.unit}
                    </td>
                    <td className="px-4 py-3">
                      {t.rawQtyNeeded} {t.unit}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={t.priority === "HIGH" ? "bg-orange-100 text-orange-800" : ""}>
                        {t.priority}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {data && tab === "par" ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Suggested qty</th>
                <th className="px-4 py-3">Est. cost</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.adjustedPar.slice(0, 15).map((row) => (
                <tr key={row.name} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.vendor}</td>
                  <td className="px-4 py-3">
                    {row.suggestedQty} {row.unit}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(row.lineTotal)}</td>
                  <td className="px-4 py-3 text-slate-600">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {data && tab === "trends" ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <TrendingUp className="h-4 w-4" />
            Correlations from the last 90 days — high-confidence alerts also appear in Command Center.
          </p>
          {data.microTrends.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
              Not enough tagged days yet. Log weather & events under Analytics → External factors.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.microTrends.map((t) => (
                <article key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-slate-900">{t.itemName}</h4>
                    <Badge className={confidenceColor[t.confidence]}>{t.confidence}</Badge>
                    <Badge className={t.impactPct >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                      {t.impactPct > 0 ? "+" : ""}
                      {t.impactPct}%
                    </Badge>
                  </div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{t.trigger}</p>
                  <p className="mt-2 text-sm text-slate-700">{t.action}</p>
                  <p className="mt-2 text-xs text-slate-400">{t.sampleSize} sample days · {t.category}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
