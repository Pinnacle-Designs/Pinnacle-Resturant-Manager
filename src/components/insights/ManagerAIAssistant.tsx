"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Radar,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { PageSectionShell, PageSection } from "@/components/layout/PageSections";
import { useAuth } from "@/components/auth/AuthProvider";
import { PlanUpgradeBanner } from "@/components/account/PlanUpgradeBanner";
import {
  canUseAdvancedAI,
  canUseCommandCenter,
  PLAN_BY_ID,
  STARTER_AI_DAILY_LIMIT,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

interface DashboardCommand {
  id: string;
  label: string;
  question: string;
}

interface PromptCategory {
  id: string;
  label: string;
  promptCount: number;
}

interface LiveSignal {
  domain: string;
  label: string;
  value: string;
  status: "green" | "yellow" | "red";
  detail?: string;
}

interface CommandFinding {
  domain: string;
  severity: "high" | "medium" | "low";
  title: string;
  evidence: string;
  impact: string;
  action: string;
}

interface CommandMetric {
  label: string;
  value: string;
  subtext?: string;
}

interface ManagerAnswer {
  question: string;
  answer: string;
  categoryLabel: string;
  confidence: "high" | "medium" | "low";
  relatedActions: string[];
  usedAI: boolean;
  mode?: "command_center" | "chat";
  headline?: string;
  summary?: string;
  signals?: LiveSignal[];
  findings?: CommandFinding[];
  metrics?: CommandMetric[];
  domainsScanned?: string[];
}

const SCAN_DOMAINS = [
  "Sales",
  "Labor",
  "Inventory",
  "Scheduling",
  "Vendor invoices",
  "Waste logs",
  "Guest reviews",
  "Employee performance",
];

const STARTER_QUICK_COMMANDS = [
  "What were yesterday's sales?",
  "Which inventory items are running low?",
  "How many orders did we have this week?",
];

const QUICK_COMMANDS = [
  "What's hurting my profit this week?",
  "What needs my attention before dinner rush?",
  "Scan the restaurant and tell me what needs attention.",
  "Give me today's sales, labor, inventory, staffing, and guest service summary.",
];

const SIGNAL_STYLES = {
  green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  yellow: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  red: "bg-red-500/20 text-red-300 border-red-500/30",
};

const SIGNAL_DOT = {
  green: "bg-emerald-400",
  yellow: "bg-amber-400",
  red: "bg-red-400",
};

const SEVERITY_STYLES = {
  high: "border-l-red-500 bg-red-50/80",
  medium: "border-l-amber-500 bg-amber-50/80",
  low: "border-l-slate-300 bg-slate-50/80",
};

const DOMAIN_COLORS: Record<string, string> = {
  sales: "bg-blue-100 text-blue-800",
  labor: "bg-purple-100 text-purple-800",
  inventory: "bg-orange-100 text-orange-800",
  scheduling: "bg-indigo-100 text-indigo-800",
  vendors: "bg-teal-100 text-teal-800",
  waste: "bg-rose-100 text-rose-800",
  reviews: "bg-pink-100 text-pink-800",
  employees: "bg-cyan-100 text-cyan-800",
  operations: "bg-slate-100 text-slate-800",
  profitability: "bg-green-100 text-green-800",
  menu: "bg-yellow-100 text-yellow-800",
};

function renderAnswerText(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i} className="block">
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} className="font-semibold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={j}>{part}</span>;
        })}
      </span>
    );
  });
}

export function ManagerAIAssistant() {
  const { user } = useAuth();
  const plan = user?.plan ?? "STARTER";
  const commandCenterEnabled = canUseCommandCenter(plan);
  const advancedAiEnabled = canUseAdvancedAI(plan);
  const [commands, setCommands] = useState<DashboardCommand[]>([]);
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [categoryPrompts, setCategoryPrompts] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [liveSignals, setLiveSignals] = useState<LiveSignal[]>([]);
  const [locationName, setLocationName] = useState("Your restaurant");
  const [statusLoading, setStatusLoading] = useState(true);
  const [answer, setAnswer] = useState<ManagerAnswer | null>(null);
  const [searchResults, setSearchResults] = useState<
    Array<{ question: string; categoryLabel: string }>
  >([]);

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((data) => {
        setLiveSignals(data.signals ?? []);
        setLocationName(data.locationName ?? "Your restaurant");
      })
      .finally(() => setStatusLoading(false));

    fetch("/api/ai/prompts")
      .then((r) => r.json())
      .then((data) => {
        setCommands(data.dashboardCommands ?? []);
        setCategories(data.categories ?? []);
      });
  }, []);

  useEffect(() => {
    if (!loading) {
      setScanStep(0);
      return;
    }
    const interval = setInterval(() => {
      setScanStep((s) => (s + 1) % (SCAN_DOMAINS.length + 1));
    }, 400);
    return () => clearInterval(interval);
  }, [loading]);

  const loadCategory = useCallback(
    async (id: string) => {
      if (categoryPrompts[id]) return;
      const res = await fetch(`/api/ai/prompts?category=${id}`);
      const data = await res.json();
      if (data.prompts) {
        setCategoryPrompts((prev) => ({ ...prev, [id]: data.prompts }));
      }
    },
    [categoryPrompts]
  );

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setQuestion(trimmed);
    setAnswer(null);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      setAnswer(data.error ? { ...data, question: trimmed, answer: data.error } : data);
      if (data.signals) setLiveSignals(data.signals);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/ai/prompts?q=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((data) => {
          setSearchResults(
            (data.prompts ?? []).map((p: { question: string; categoryLabel: string }) => ({
              question: p.question,
              categoryLabel: p.categoryLabel,
            }))
          );
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const redCount = liveSignals.filter((s) => s.status === "red").length;
  const yellowCount = liveSignals.filter((s) => s.status === "yellow").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Command center header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-6 py-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-300">
              <Radar className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-widest">
                Restaurant Command Center
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{locationName}</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              Ask plain-English questions. The system cross-checks sales, labor, inventory,
              scheduling, vendor invoices, waste, reviews, and employee data — together.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-200">Live</span>
            {redCount > 0 && (
              <Badge className="bg-red-500/30 text-red-200">{redCount} critical</Badge>
            )}
            {yellowCount > 0 && (
              <Badge className="bg-amber-500/30 text-amber-200">{yellowCount} watch</Badge>
            )}
          </div>
        </div>

        {/* Live signal strip */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {statusLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-white/5" />
              ))
            : liveSignals.map((s) => (
                <div
                  key={s.label}
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    SIGNAL_STYLES[s.status]
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", SIGNAL_DOT[s.status])} />
                    <span className="text-xs font-medium opacity-80">{s.label}</span>
                  </div>
                  <p className="mt-0.5 text-lg font-bold">{s.value}</p>
                  {s.detail && (
                    <p className="truncate text-[10px] opacity-70">{s.detail}</p>
                  )}
                </div>
              ))}
        </div>

        {/* Command input */}
        <div className="mt-5">
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask(question)}
              placeholder="What's hurting my profit this week?"
              className="flex-1 rounded-xl border-0 bg-white/95 px-4 py-3.5 text-base text-slate-900 shadow-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <Button
              onClick={() => ask(question)}
              disabled={loading || !question.trim()}
              className="h-auto rounded-xl bg-indigo-500 px-5 hover:bg-indigo-400"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Zap className="h-5 w-5" />
              )}
              <span className="ml-2 hidden sm:inline">Analyze</span>
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(commandCenterEnabled ? QUICK_COMMANDS : STARTER_QUICK_COMMANDS).map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => {
                  setQuestion(cmd);
                  ask(cmd);
                }}
                disabled={loading}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/20 disabled:opacity-50"
              >
                {cmd.length > 42 ? `${cmd.slice(0, 42)}…` : cmd}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions & response */}
      <div className="px-6 pb-6">
      {!commandCenterEnabled && (
        <PlanUpgradeBanner
          className="mb-4"
          title={`${PLAN_BY_ID.GROWTH.name} unlocks the full Command Center`}
          description={`Your ${PLAN_BY_ID[plan].name} plan includes ${STARTER_AI_DAILY_LIMIT} AI questions per day. Upgrade for live scans, signal board commands, and the full prompt library.`}
          requiredPlan="GROWTH"
        />
      )}
      {!advancedAiEnabled && commandCenterEnabled && (
        <PlanUpgradeBanner
          className="mb-4"
          title={`${PLAN_BY_ID.PRO.name} unlocks advanced profitability AI`}
          description="Profit-by-item, shift, channel, and marketing ROI prompts require Pro."
          requiredPlan="PRO"
        />
      )}
      <PageSectionShell pageId="command-center">
        {commandCenterEnabled ? (
        <PageSection id="cc-quick" title="Quick commands" defaultOpen>
          <div className="flex flex-wrap gap-2">
            {commands.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => ask(cmd.question)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                {cmd.label}
              </button>
            ))}
          </div>
        </PageSection>
        ) : null}

        <PageSection id="cc-response" title="Analysis results">
          <div className="px-6 py-5">
        {loading && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
            <div className="flex items-center gap-2 text-indigo-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Cross-checking restaurant data…</span>
            </div>
            <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {SCAN_DOMAINS.map((domain, i) => (
                <div
                  key={domain}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                    i <= scanStep ? "bg-white text-indigo-800 shadow-sm" : "text-slate-400"
                  )}
                >
                  {i < scanStep ? (
                    <span className="text-emerald-500">✓</span>
                  ) : i === scanStep ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="h-3.5 w-3.5" />
                  )}
                  {domain}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && answer && (
          <div className="space-y-5">
            {/* Headline */}
            {answer.headline && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Command center response
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{answer.headline}</h3>
                {answer.summary && (
                  <p className="mt-1 text-sm text-slate-500">{answer.summary}</p>
                )}
              </div>
            )}

            {/* Metrics row */}
            {answer.metrics && answer.metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {answer.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                  >
                    <p className="text-xs text-slate-500">{m.label}</p>
                    <p className="text-lg font-bold text-slate-900">{m.value}</p>
                    {m.subtext && (
                      <p className="truncate text-[10px] text-slate-400">{m.subtext}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Findings cards */}
            {answer.findings && answer.findings.length > 0 && (
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Cross-domain findings
                </p>
                <div className="space-y-2">
                  {answer.findings.map((f, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border-l-4 p-4",
                        SEVERITY_STYLES[f.severity]
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={DOMAIN_COLORS[f.domain] ?? "bg-slate-100 text-slate-700"}>
                          {f.domain}
                        </Badge>
                        {f.impact !== "—" && (
                          <span className="text-sm font-semibold text-red-700">{f.impact}</span>
                        )}
                      </div>
                      <p className="mt-1 font-semibold text-slate-900">{f.title}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{f.evidence}</p>
                      <p className="mt-2 text-sm font-medium text-indigo-700">→ {f.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full narrative (when no findings or GPT answer) */}
            {(!answer.findings || answer.findings.length === 0) && (
              <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm leading-relaxed text-slate-700">
                {renderAnswerText(answer.answer)}
              </div>
            )}

            {/* Actions */}
            {answer.relatedActions.length > 0 && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  Priority actions
                </p>
                <ul className="mt-2 space-y-1.5">
                  {answer.relatedActions.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="font-bold text-indigo-500">{i + 1}.</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Data sources footer */}
            {answer.domainsScanned && (
              <p className="text-xs text-slate-400">
                Analyzed:{" "}
                {answer.domainsScanned
                  .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
                  .join(" · ")}
                {answer.usedAI && " · GPT synthesis"}
              </p>
            )}
          </div>
        )}

        {!loading && !answer && (
          <div className="py-8 text-center text-sm text-slate-400">
            <Radar className="mx-auto h-10 w-10 text-slate-200" />
            <p className="mt-3">
              Ask anything about your restaurant — profit, staffing, inventory, guests, and more.
            </p>
          </div>
        )}
          </div>
        </PageSection>

        <PageSection id="cc-library" title="Browse 350+ manager questions">
          {!commandCenterEnabled ? (
            <PlanUpgradeBanner
              title={`${PLAN_BY_ID.GROWTH.name} unlocks the prompt library`}
              description={`Starter includes ${STARTER_AI_DAILY_LIMIT} AI questions per day with basic prompts only.`}
              requiredPlan="GROWTH"
            />
          ) : (
          <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
              {searchResults.map((r) => (
                <button
                  key={r.question}
                  type="button"
                  onClick={() => ask(r.question)}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <span className="text-xs text-slate-400">{r.categoryLabel} · </span>
                  {r.question}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 divide-y divide-slate-100">
            {categories.map((cat) => (
              <div key={cat.id}>
                <button
                  type="button"
                  onClick={() => {
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(cat.id)) next.delete(cat.id);
                      else {
                        next.add(cat.id);
                        void loadCategory(cat.id);
                      }
                      return next;
                    });
                  }}
                  className="flex w-full items-center justify-between py-2.5 text-left text-sm text-slate-700"
                >
                  <span>
                    {cat.label}
                    <span className="ml-2 text-xs text-slate-400">({cat.promptCount})</span>
                  </span>
                  {expanded.has(cat.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {expanded.has(cat.id) && categoryPrompts[cat.id] && (
                  <div className="pb-2 pl-2">
                    {categoryPrompts[cat.id].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => ask(prompt)}
                        className="block w-full rounded px-2 py-1 text-left text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-800"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          </>
          )}
        </PageSection>
      </PageSectionShell>
      </div>
    </div>
  );
}
