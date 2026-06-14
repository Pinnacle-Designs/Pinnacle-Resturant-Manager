"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui";
import { InsightPanel } from "@/components/insights/InsightPanel";
import { ManagerAIAssistant } from "@/components/insights/ManagerAIAssistant";

interface Insight {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  actionable: string | null;
  resolved: boolean;
  createdAt: string;
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    const res = await fetch("/api/insights/analyze");
    const data = await res.json();
    setInsights(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return (
    <div>
      <PageHeader
        title="Command Center"
        description="Your restaurant's AI brain — cross-checks every system and answers in plain English"
      />

      <div className="mb-8">
        <ManagerAIAssistant />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading insights...</p>
      ) : (
        <InsightPanel insights={insights} onRefresh={fetchInsights} />
      )}

      <div className="mt-8 card">
        <h2 className="font-semibold text-slate-900">How the Command Center Works</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li>
            • Pulls live data from sales, labor, inventory, scheduling, vendor invoices, waste
            logs, guest reviews, and employee performance — in one pass
          </li>
          <li>
            • Answers plain-English questions like &quot;What&apos;s hurting my profit this
            week?&quot; with cross-domain findings and dollar impacts
          </li>
          <li>
            • Shows a live red/yellow/green signal board for sales, profit, labor, food cost,
            guests, and operations
          </li>
          <li>
            • With OpenAI, synthesizes creative outputs (checklists, review responses) grounded
            in your real numbers
          </li>
          <li>• Automated insights below flag issues between command center sessions</li>
        </ul>
        <p className="mt-4 text-xs text-slate-400">
          Set OPENAI_API_KEY in .env for full AI capabilities.
        </p>
      </div>
    </div>
  );
}
