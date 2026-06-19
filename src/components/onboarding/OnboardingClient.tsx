"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  CreditCard,
  Database,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Input, FormField } from "@/components/ui/form";
import { PageSectionShell, PageSection } from "@/components/layout/PageSections";
import { PLAN_BY_ID } from "@/lib/plans";
import { cn, formatCurrency } from "@/lib/utils";
import type { PlanId } from "@/lib/plans";

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { id: 1 as Step, label: "Restaurant", icon: Building2 },
  { id: 2 as Step, label: "Sample data", icon: Database },
  { id: 3 as Step, label: "Billing", icon: CreditCard },
  { id: 4 as Step, label: "Launch", icon: CheckCircle2 },
];

interface OnboardingState {
  location: {
    name: string;
    address: string | null;
    phone: string | null;
    seatCount: number;
    onboardingStep: number;
    autopayEnabled: boolean;
    postalCode: string | null;
    city: string | null;
    stateProvince: string | null;
    countryCode: string;
  };
  plan: { id: PlanId; name: string; monthlyAmount: number };
  stripeConfigured: boolean;
  billingRequired?: boolean;
  trialDays?: number;
}

export function OnboardingClient() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [seatCount, setSeatCount] = useState("40");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load onboarding");
      setData(json);
      setName(json.location.name || "");
      setAddress(json.location.address === "Add your address" ? "" : json.location.address || "");
      setPhone(json.location.phone || "");
      setPostalCode(json.location.postalCode || "");
      setCity(json.location.city || "");
      setStateProvince(json.location.stateProvince || "");
      setCountryCode(json.location.countryCode || "US");
      setSeatCount(String(json.location.seatCount || 40));
      const saved = Math.min(4, Math.max(1, (json.location.onboardingStep || 0) + 1)) as Step;
      const nextStep =
        json.location.autopayEnabled && saved < 4 ? (4 as Step) : saved;
      setStep(nextStep);
      if (json.location.autopayEnabled && saved < 4) {
        setMessage("Stripe autopay connected. You're almost ready.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load onboarding");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("stripe") === "success") {
      setMessage("Stripe autopay connected. You're almost ready.");
      setStep(4);
    }
  }, [searchParams]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      return json;
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async () => {
    try {
      await patch({
        action: "details",
        name,
        address,
        phone,
        postalCode,
        city,
        stateProvince,
        countryCode,
        seatCount: Number(seatCount),
      });
      setStep(2);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save details");
    }
  };

  const seedData = async () => {
    try {
      const json = await patch({ action: "seed" });
      setMessage(json.message);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sample data");
    }
  };

  const skipSeed = async () => {
    try {
      await patch({ action: "skip-seed" });
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue");
    }
  };

  const startStripe = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/billing/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "onboarding" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start Stripe checkout");
      if (json.url) window.location.assign(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Stripe checkout");
    } finally {
      setBusy(false);
    }
  };

  const skipBilling = async () => {
    try {
      await patch({ action: "billing-skipped" });
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue");
    }
  };

  const finish = async () => {
    try {
      await patch({ action: "complete" });
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish onboarding");
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Preparing your workspace…</div>;
  }

  if (error && !data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error}</div>;
  }

  const plan = data?.plan;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="text-center">
        <p className="text-sm font-medium text-orange-600">Welcome to Pinnacle</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Set up your restaurant</h1>
        <p className="mt-2 text-sm text-slate-600">
          {plan ? `${plan.name} plan — ${formatCurrency(plan.monthlyAmount)}/mo` : "A few steps and you're live."}
        </p>
      </div>

      <nav className="mt-8 flex justify-between gap-2">
        {STEPS.map((item) => {
          const Icon = item.icon;
          const active = step === item.id;
          const done = step > item.id;
          return (
            <div
              key={item.id}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-3 text-center text-xs",
                active ? "bg-orange-50 text-orange-700" : done ? "text-green-700" : "text-slate-400"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{item.label}</span>
            </div>
          );
        })}
      </nav>

      <div className="mt-6">
        <PageSectionShell pageId="onboarding" defaultExpanded="all">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {message && <p className="mb-4 text-sm text-green-700">{message}</p>}

        {step === 1 && (
          <PageSection
            id="onboarding-restaurant"
            title="Restaurant details"
            description="Tell us about your location so reports and schedules are accurate."
            defaultOpen
          >
            <div className="space-y-4">
              <FormField label="Restaurant name *">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
              <FormField label="Address">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="City">
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </FormField>
                <FormField label="State / province">
                  <Input value={stateProvince} onChange={(e) => setStateProvince(e.target.value)} placeholder="TX" />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Postal / ZIP code">
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="78701" />
                </FormField>
                <FormField label="Country">
                  <select
                    className="input w-full"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                  </select>
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
                </FormField>
                <FormField label="Seats">
                  <Input type="number" min={1} max={500} value={seatCount} onChange={(e) => setSeatCount(e.target.value)} />
                </FormField>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="button" disabled={busy || !name.trim()} onClick={() => void saveDetails()}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </PageSection>
        )}

        {step === 2 && (
          <PageSection
            id="onboarding-sample-data"
            title="Load sample data?"
            description="We can add a starter menu, inventory, staff, tables, and expenses so you can explore the app immediately."
            defaultOpen
          >
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={busy} onClick={() => void seedData()}>
                Load sample data
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void skipSeed()}>
                Start empty
              </Button>
            </div>
            <button type="button" className="mt-4 text-sm text-slate-500 hover:text-slate-700" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-1 inline h-3 w-3" /> Back
            </button>
          </PageSection>
        )}

        {step === 3 && plan && (
          <PageSection
            id="onboarding-billing"
            title="Subscription billing"
            description={`Connect Stripe for PCI-compliant autopay on your ${plan.name} plan (${formatCurrency(plan.monthlyAmount)}/mo). Card data never touches Pinnacle servers.`}
            defaultOpen
          >
            {data?.billingRequired && (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Production accounts need autopay or an active {data.trialDays ?? 14}-day trial before launch.
              </p>
            )}
            <ul className="space-y-2 text-sm text-slate-600">
              {PLAN_BY_ID[plan.id].features.slice(0, 4).map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              {data?.stripeConfigured ? (
                <Button type="button" disabled={busy} onClick={() => void startStripe()}>
                  <CreditCard className="h-4 w-4" />
                  Set up autopay with Stripe
                </Button>
              ) : (
                <p className="text-sm text-amber-700">
                  Stripe is not configured on this server. You can set up billing later in Account settings.
                </p>
              )}
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void skipBilling()}>
                {data?.billingRequired ? "Continue on trial" : "Skip for now"}
              </Button>
            </div>
            <button type="button" className="mt-4 text-sm text-slate-500 hover:text-slate-700" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-1 inline h-3 w-3" /> Back
            </button>
          </PageSection>
        )}

        {step === 4 && (
          <PageSection id="onboarding-launch" title="You're ready" defaultOpen>
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <p className="mt-2 text-sm text-slate-600">
                Your workspace is configured. Install the app on your devices, then open the dashboard
                to start managing orders, inventory, and staff.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <a
                  href="/download?from=onboarding"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Download app
                </a>
                <Button type="button" disabled={busy} onClick={() => void finish()}>
                  Go to dashboard
                </Button>
              </div>
            </div>
          </PageSection>
        )}
      </PageSectionShell>
      </div>
    </div>
  );
}
