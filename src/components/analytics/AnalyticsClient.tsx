"use client";

import { useEffect, useState } from "react";
import { PageHeader, StatCard, Badge } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AnalyticsPayload } from "@/lib/analytics/types";
import { INSIGHT_SEVERITY_COLORS } from "@/lib/constants";

const TABS = [
  { id: "executive", label: "Executive" },
  { id: "sales", label: "Sales" },
  { id: "food", label: "Food & Inventory" },
  { id: "labor", label: "Labor" },
  { id: "menu", label: "Menu Engineering" },
  { id: "marketing", label: "Marketing" },
  { id: "customer", label: "Guest Experience" },
  { id: "operations", label: "Operations" },
  { id: "purchasing", label: "Purchasing" },
  { id: "forecasting", label: "Forecasting" },
  { id: "profitability", label: "Profitability" },
  { id: "external", label: "External Factors" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Questions({ items }: { items: string[] }) {
  return (
    <div className="mt-4 rounded-lg border bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase text-slate-400">Questions answered</p>
      <ul className="mt-2 space-y-1 text-sm text-slate-600">
        {items.map((q) => (
          <li key={q}>• {q}</li>
        ))}
      </ul>
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">No data yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            {headers.map((h) => (
              <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-slate-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [tab, setTab] = useState<TabId>("executive");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading analytics...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const e = data.executive;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description={`Restaurant intelligence — last ${data.periodDays} days`}
      />

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-white p-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm",
              tab === id ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "executive" && (
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-semibold text-slate-900">Yesterday</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Sales" value={formatCurrency(e.yesterday.sales)} />
              <StatCard label="Net Sales" value={formatCurrency(e.yesterday.netSales)} />
              <StatCard label="Food Cost %" value={`${e.yesterday.foodCostPct.toFixed(1)}%`} />
              <StatCard label="Labor %" value={`${e.yesterday.laborPct.toFixed(1)}%`} />
              <StatCard label="Prime Cost %" value={`${e.yesterday.primeCostPct.toFixed(1)}%`} />
              <StatCard label="Profit Est." value={formatCurrency(e.yesterday.profitEstimate)} />
              <StatCard label="Guests" value={e.yesterday.guestCount} />
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold">Last 7 Days Trends</h2>
            <DataTable
              headers={["Date", "Sales", "Profit Est.", "Avg Rating"]}
              rows={e.last7Days.salesTrend.map((s, i) => [
                s.date,
                formatCurrency(s.sales),
                formatCurrency(e.last7Days.profitTrend[i]?.profit ?? 0),
                e.last7Days.reviewTrend[i]?.avgRating.toFixed(1) ?? "—",
              ])}
            />
          </div>

          {e.alerts.length > 0 && (
            <div className="card border-amber-200 bg-amber-50">
              <h2 className="font-semibold text-amber-900">Alerts</h2>
              <ul className="mt-3 space-y-2">
                {e.alerts.map((a) => (
                  <li key={a.message} className="text-sm text-amber-800">• {a.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <h2 className="font-semibold">AI Insights</h2>
            <ul className="mt-3 space-y-3">
              {data.aiInsights.map((ins) => (
                <li key={ins.title} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge className={INSIGHT_SEVERITY_COLORS[ins.severity]}>{ins.severity}</Badge>
                    <span className="font-medium text-slate-800">{ins.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{ins.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "sales" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Sales" value={formatCurrency(data.sales.totalSales)} />
            <StatCard label="Net Sales" value={formatCurrency(data.sales.netSales)} />
            <StatCard label="Avg Check" value={formatCurrency(data.sales.averageCheck)} />
            <StatCard label="Guests" value={data.sales.guestCount} />
            <StatCard label="Rev / Seat" value={formatCurrency(data.sales.revenuePerSeat)} />
            <StatCard label="Rev / Labor Hr" value={formatCurrency(data.sales.revenuePerLaborHour)} />
            <StatCard label="Rev / Sq Ft" value={formatCurrency(data.sales.revenuePerSqFt)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="font-semibold">By Daypart</h3>
              <DataTable
                headers={["Daypart", "Sales", "Orders"]}
                rows={data.sales.byDaypart.map((d) => [d.daypart, formatCurrency(d.sales), d.orders])}
              />
            </div>
            <div className="card">
              <h3 className="font-semibold">By Channel</h3>
              <DataTable
                headers={["Channel", "Sales", "Profit"]}
                rows={data.sales.byChannel.map((c) => [c.channel, formatCurrency(c.sales), formatCurrency(c.profit)])}
              />
            </div>
            <div className="card">
              <h3 className="font-semibold">Top Menu Items</h3>
              <DataTable
                headers={["Item", "Sales", "Qty"]}
                rows={data.sales.byMenuItem.map((i) => [i.name, formatCurrency(i.sales), i.quantity])}
              />
            </div>
            <div className="card">
              <h3 className="font-semibold">By Category</h3>
              <DataTable
                headers={["Category", "Sales", "Qty"]}
                rows={data.sales.byCategory.map((c) => [c.category, formatCurrency(c.sales), c.quantity])}
              />
            </div>
          </div>
          <Questions items={data.sales.questions} />
        </div>
      )}

      {tab === "food" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Food Cost %" value={`${data.foodCost.foodCostPct.toFixed(1)}%`} />
            <StatCard label="Theoretical %" value={`${data.foodCost.theoreticalFoodCostPct.toFixed(1)}%`} />
            <StatCard label="Variance" value={`${data.foodCost.variancePct.toFixed(1)}%`} />
            <StatCard label="Inventory Value" value={formatCurrency(data.foodCost.inventoryValuation)} />
            <StatCard label="Waste" value={formatCurrency(data.foodCost.wasteCost)} />
            <StatCard label="Turnover" value={data.foodCost.inventoryTurnover.toFixed(2)} />
            <StatCard label="Days on Hand" value={data.foodCost.daysOnHand.toFixed(0)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="font-semibold">Top Cost Drivers</h3>
              <DataTable
                headers={["Item", "Value", "Price Δ%"]}
                rows={data.foodCost.topCostDrivers.map((i) => [i.name, formatCurrency(i.cost), `${i.changePct.toFixed(1)}%`])}
              />
            </div>
            <div className="card">
              <h3 className="font-semibold">Low Stock</h3>
              <DataTable
                headers={["Item", "Qty", "Min"]}
                rows={data.foodCost.lowStockItems.map((i) => [i.name, i.quantity, i.minQuantity])}
              />
            </div>
          </div>
          <Questions items={data.foodCost.questions} />
        </div>
      )}

      {tab === "labor" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Labor %" value={`${data.labor.laborPct.toFixed(1)}%`} />
            <StatCard label="Labor Cost" value={formatCurrency(data.labor.laborCost)} />
            <StatCard label="Scheduled Hrs" value={data.labor.scheduledHours.toFixed(0)} />
            <StatCard label="Sales / Labor Hr" value={formatCurrency(data.labor.salesPerLaborHour)} />
            <StatCard label="Guests / Labor Hr" value={data.labor.guestsPerLaborHour.toFixed(1)} />
            <StatCard label="Overtime %" value={`${data.labor.overtimePct.toFixed(1)}%`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="font-semibold">By Position</h3>
              <DataTable
                headers={["Role", "Hours", "Cost"]}
                rows={data.labor.byPosition.map((p) => [p.role, p.hours.toFixed(1), formatCurrency(p.cost)])}
              />
            </div>
            <div className="card">
              <h3 className="font-semibold">By Shift</h3>
              <DataTable
                headers={["Shift", "Hours", "Sales"]}
                rows={data.labor.byShift.map((s) => [s.label, s.hours.toFixed(0), formatCurrency(s.sales)])}
              />
            </div>
          </div>
          <Questions items={data.labor.questions} />
        </div>
      )}

      {tab === "menu" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Stars" value={data.menuEngineering.stars} subtext="High profit, popular" />
            <StatCard label="Plowhorses" value={data.menuEngineering.plowhorses} subtext="Popular, low margin" />
            <StatCard label="Puzzles" value={data.menuEngineering.puzzles} subtext="High margin, low sales" />
            <StatCard label="Dogs" value={data.menuEngineering.dogs} subtext="Low margin, low sales" />
          </div>
          <div className="card">
            <h3 className="font-semibold">Menu Matrix</h3>
            <DataTable
              headers={["Item", "Quadrant", "Price", "Cost", "Margin %", "Sold", "Contribution"]}
              rows={data.menuEngineering.items.map((m) => [
                m.name,
                m.quadrant.toUpperCase(),
                formatCurrency(m.price),
                formatCurrency(m.recipeCost),
                `${m.marginPct.toFixed(0)}%`,
                m.quantitySold,
                formatCurrency(m.contribution),
              ])}
            />
          </div>
          <Questions items={data.menuEngineering.questions} />
        </div>
      )}

      {tab === "marketing" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Marketing Spend" value={formatCurrency(data.marketing.totalSpend)} />
            <StatCard label="CAC" value={formatCurrency(data.marketing.customerAcquisitionCost)} />
            <StatCard label="Repeat Rate" value={`${data.marketing.repeatVisitRate.toFixed(0)}%`} />
            <StatCard label="LTV Est." value={formatCurrency(data.marketing.lifetimeValueEstimate)} />
          </div>
          <div className="card">
            <h3 className="font-semibold">Campaigns</h3>
            <DataTable
              headers={["Campaign", "Channel", "Spend", "Revenue", "ROAS"]}
              rows={data.marketing.campaigns.map((c) => [
                c.name, c.channel, formatCurrency(c.spend), formatCurrency(c.revenue), `${c.roas.toFixed(1)}x`,
              ])}
            />
          </div>
          <Questions items={data.marketing.questions} />
        </div>
      )}

      {tab === "customer" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Avg Rating" value={data.customerExperience.avgRating.toFixed(1)} />
            <StatCard label="Reviews" value={data.customerExperience.reviewCount} />
            <StatCard label="Unresolved" value={data.customerExperience.unresolvedCount} />
          </div>
          <div className="card">
            <h3 className="font-semibold">Recent Reviews</h3>
            <ul className="mt-3 space-y-2">
              {data.customerExperience.recentReviews.map((r, i) => (
                <li key={i} className="rounded border p-3 text-sm">
                  <span className="font-medium">{r.source}</span> · {r.rating}★
                  {r.comment && <p className="mt-1 text-slate-600">{r.comment}</p>}
                </li>
              ))}
            </ul>
          </div>
          <Questions items={data.customerExperience.questions} />
        </div>
      )}

      {tab === "operations" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Avg Ticket Time" value={`${data.operations.avgTicketTimeMinutes.toFixed(0)} min`} />
            <StatCard label="Accuracy" value={`${data.operations.orderAccuracyPct.toFixed(1)}%`} />
            <StatCard label="Void Rate" value={`${data.operations.voidRatePct.toFixed(2)}%`} />
            <StatCard label="Peak Daypart" value={data.operations.bottleneckDaypart} />
          </div>
          <Questions items={data.operations.questions} />
        </div>
      )}

      {tab === "purchasing" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Purchases" value={formatCurrency(data.purchasing.totalPurchases)} />
            <StatCard label="Vendors" value={data.purchasing.vendorCount} />
            <StatCard label="Cost Inflation" value={`${data.purchasing.costInflationPct.toFixed(1)}%`} />
          </div>
          <div className="card">
            <h3 className="font-semibold">Top Vendors</h3>
            <DataTable
              headers={["Vendor", "Spend", "Orders"]}
              rows={data.purchasing.topVendors.map((v) => [v.vendor, formatCurrency(v.spend), v.orders])}
            />
          </div>
          <Questions items={data.purchasing.questions} />
        </div>
      )}

      {tab === "forecasting" && (
        <div className="space-y-6">
          <p className="text-sm text-slate-600">{data.forecasting.seasonalNote}</p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="font-semibold">Sales Forecast (7d)</h3>
              <DataTable
                headers={["Date", "Predicted"]}
                rows={data.forecasting.salesForecast7d.map((f) => [f.date, formatCurrency(f.predicted)])}
              />
            </div>
            <div className="card">
              <h3 className="font-semibold">Inventory Orders</h3>
              <DataTable
                headers={["Item", "Suggested", "Unit"]}
                rows={data.forecasting.inventoryRecommendations.map((i) => [i.name, i.suggestedOrder, i.unit])}
              />
            </div>
          </div>
          <Questions items={data.forecasting.questions} />
        </div>
      )}

      {tab === "profitability" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Gross Profit" value={formatCurrency(data.profitability.grossProfit)} />
            <StatCard label="Net Profit Est." value={formatCurrency(data.profitability.netProfitEstimate)} />
            <StatCard label="Margin %" value={`${data.profitability.profitMarginPct.toFixed(1)}%`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="font-semibold">Profit by Item</h3>
              <DataTable
                headers={["Item", "Profit", "Margin %"]}
                rows={data.profitability.byMenuItem.map((i) => [i.name, formatCurrency(i.profit), `${i.marginPct.toFixed(0)}%`])}
              />
            </div>
            <div className="card">
              <h3 className="font-semibold">Profit by Channel</h3>
              <DataTable
                headers={["Channel", "Profit"]}
                rows={data.profitability.byChannel.map((c) => [c.channel, formatCurrency(c.profit)])}
              />
            </div>
          </div>
          <Questions items={data.profitability.questions} />
        </div>
      )}

      {tab === "external" && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold">Recorded Factors</h3>
            <DataTable
              headers={["Date", "Type", "Impact", "Description"]}
              rows={data.externalFactors.factors.map((f) => [
                f.date.split("T")[0],
                f.factorType,
                `${f.impactPct}%`,
                f.description,
              ])}
            />
          </div>
          <div className="card">
            <h3 className="font-semibold">Learned Patterns</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {data.externalFactors.patterns.map((p) => (
                <li key={p.pattern}><strong>{p.pattern}:</strong> {p.insight}</li>
              ))}
            </ul>
          </div>
          <Questions items={data.externalFactors.questions} />
        </div>
      )}

      <div className="mt-8 card">
        <h2 className="font-semibold">Coverage Checklist</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.coverage.sections.map((s) => (
            <Badge
              key={s.id}
              className={s.covered ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}
            >
              {s.label} {s.covered ? "✓" : "—"}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
