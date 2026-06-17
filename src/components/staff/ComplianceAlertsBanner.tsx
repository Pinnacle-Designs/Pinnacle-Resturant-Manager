"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type MealBreakAlert = {
  entryId: string;
  staffName: string;
  dueLabel: string;
  overdue: boolean;
};

type MinorAlert = {
  staffName: string;
  message: string;
  minutesUntilViolation: number;
  clockedIn: boolean;
};

interface ComplianceAlertsBannerProps {
  variant?: "banner" | "panel";
  className?: string;
}

export function ComplianceAlertsBanner({
  variant = "banner",
  className = "",
}: ComplianceAlertsBannerProps) {
  const [mealBreakAlerts, setMealBreakAlerts] = useState<MealBreakAlert[]>([]);
  const [minorAlerts, setMinorAlerts] = useState<MinorAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/alerts");
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setMealBreakAlerts([]);
          setMinorAlerts([]);
        }
        return;
      }
      setMealBreakAlerts(data.mealBreakAlerts ?? []);
      setMinorAlerts((data.minorAlerts ?? []).filter((a: MinorAlert) => a.clockedIn));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || (mealBreakAlerts.length === 0 && minorAlerts.length === 0)) {
    return null;
  }

  const urgent =
    mealBreakAlerts.some((a) => a.overdue) ||
    minorAlerts.some((a) => a.minutesUntilViolation <= 0);

  const content = (
    <>
      <div className="flex items-start gap-3">
        {urgent ? (
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
        ) : (
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-slate-900">
            Labor compliance alerts
          </p>
          {mealBreakAlerts.length > 0 && (
            <ul className="space-y-1 text-sm text-slate-700">
              {mealBreakAlerts.map((a) => (
                <li key={a.entryId} className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>
                    <strong>{a.staffName}</strong> — meal break {a.dueLabel}
                    {a.overdue && (
                      <span className="ml-1 font-medium text-red-700">(overdue)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {minorAlerts.length > 0 && (
            <ul className="space-y-1 text-sm text-slate-700">
              {minorAlerts.map((a, i) => (
                <li key={i}>
                  <strong>{a.staffName}</strong> — {a.message}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/staff?tab=compliance"
            className="inline-block text-xs font-medium text-orange-600 hover:text-orange-700"
          >
            Open compliance settings →
          </Link>
        </div>
      </div>
    </>
  );

  if (variant === "panel") {
    return (
      <div
        className={cn(
          "rounded-xl border p-4",
          urgent ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50",
          className
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-6 rounded-xl border px-4 py-3",
        urgent ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50",
        className
      )}
    >
      {content}
    </div>
  );
}
