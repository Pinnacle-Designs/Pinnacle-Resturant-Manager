"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InstallAppPrompt } from "@/components/auth/InstallAppPrompt";
import type { PlanId } from "@/lib/plans";

export function DownloadClient() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const [plan, setPlan] = useState<PlanId | undefined>();

  useEffect(() => {
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.billing?.plan) {
          setPlan(data.billing.plan as PlanId);
        }
      })
      .catch(() => undefined);
  }, []);

  const continueHref = from === "onboarding" ? "/onboarding" : "/dashboard";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-12">
      {from === "checkout" && (
        <p className="mb-6 text-center text-sm font-medium text-green-700">
          Payment received — thank you. Install the app to run your restaurant from any device.
        </p>
      )}
      <InstallAppPrompt
        plan={plan}
        onContinue={() => {
          window.location.assign(continueHref);
        }}
      />
      </div>
    </div>
  );
}
