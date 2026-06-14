"use client";

import { useEffect, useState } from "react";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";

interface PlanDemoAccount {
  email: string;
  plan: PlanId;
  locationName: string;
}

interface PlanDemoLoginsProps {
  onLogin: (email: string, password: string) => Promise<void>;
  loading: boolean;
}

export function PlanDemoLogins({ onLogin, loading }: PlanDemoLoginsProps) {
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState("demo1234");
  const [accounts, setAccounts] = useState<PlanDemoAccount[]>([]);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetch("/api/auth/plan-demos")
      .then((res) => res.json())
      .then((data) => {
        if (data.enabled) {
          setEnabled(true);
          setPassword(data.password ?? "demo1234");
          setAccounts(data.accounts ?? []);
        }
      })
      .catch(() => {});
  }, []);

  if (!enabled) return null;

  const ensureSeeded = async () => {
    setSeeding(true);
    try {
      await fetch("/api/auth/plan-demos", { method: "POST" });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Plan demos (dev only)
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Private logins for testing Starter, Growth, and Pro. Not shown in production.
      </p>
      <div className="mt-3 space-y-2">
        {accounts.map((account) => (
          <button
            key={account.email}
            type="button"
            disabled={loading || seeding}
            onClick={async () => {
              await ensureSeeded();
              await onLogin(account.email, password);
            }}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
          >
            <span className="font-medium text-slate-800">
              {PLAN_BY_ID[account.plan].name}
            </span>
            <span className="text-xs text-slate-500">{account.email}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">Password: {password}</p>
    </div>
  );
}
