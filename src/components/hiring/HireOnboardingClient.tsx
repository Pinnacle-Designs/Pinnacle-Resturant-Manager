"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Input, FormField } from "@/components/ui/form";
import { PageSectionShell, PageSection } from "@/components/layout/PageSections";
import { HANDBOOK_POLICIES } from "@/lib/hiring/handbook";
import { cn } from "@/lib/utils";

type Step = "i9" | "w4" | "deposit" | "handbook" | "done";

interface OnboardState {
  applicantName: string;
  role: string;
  locationName: string;
  status: string;
  progress: { done: number; total: number; complete: boolean };
  documents: { docType: string; completed: boolean }[];
  acknowledgments: { policyKey: string }[];
}

export function HireOnboardingClient({ token }: { token: string }) {
  const [state, setState] = useState<OnboardState | null>(null);
  const [step, setStep] = useState<Step>("i9");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signatureName, setSignatureName] = useState("");

  const [i9, setI9] = useState({
    citizenshipStatus: "citizen",
    documentList: "Driver license + Social Security card",
    startDate: "",
  });
  const [w4, setW4] = useState({
    filingStatus: "single",
    dependents: "0",
    extraWithholding: "0",
  });
  const [deposit, setDeposit] = useState({
    bankName: "",
    routingNumber: "",
    accountNumber: "",
    accountType: "checking",
  });
  const [policyIndex, setPolicyIndex] = useState(0);

  const load = async () => {
    const res = await fetch(`/api/hiring/onboarding/${token}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setState(data);
    setSignatureName(data.applicantName);
    if (data.progress.complete) setStep("done");
    else if (!data.documents.find((d: { docType: string }) => d.docType === "I9")?.completed) setStep("i9");
    else if (!data.documents.find((d: { docType: string }) => d.docType === "W4")?.completed) setStep("w4");
    else if (!data.documents.find((d: { docType: string }) => d.docType === "DIRECT_DEPOSIT")?.completed)
      setStep("deposit");
    else setStep("handbook");
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [token]);

  const submit = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/hiring/onboarding/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, signatureName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      if (payload.docType === "I9") setStep("w4");
      else if (payload.docType === "W4") setStep("deposit");
      else if (payload.docType === "DIRECT_DEPOSIT") setStep("handbook");
      else if (payload.policyKey) {
        if (policyIndex < HANDBOOK_POLICIES.length - 1) setPolicyIndex((i) => i + 1);
        else if (data.progress?.complete) setStep("done");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (error && !state) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-white p-6 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!state) {
    return <p className="text-center text-slate-500 py-12">Loading onboarding…</p>;
  }

  if (step === "done" || state.status === "COMPLETE") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">You&apos;re all set!</h1>
        <p className="mt-2 text-slate-600">
          Paperwork complete for {state.locationName}. See you on your first shift as {state.role}.
        </p>
      </div>
    );
  }

  const policy = HANDBOOK_POLICIES[policyIndex];
  const progressPct = Math.round((state.progress.done / state.progress.total) * 100);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div className="text-center">
        <p className="text-sm text-slate-500">{state.locationName}</p>
        <h1 className="text-xl font-bold text-slate-900">Welcome, {state.applicantName}</h1>
        <p className="text-sm text-slate-600">{state.role} · mobile onboarding</p>
        <div className="mx-auto mt-4 h-2 max-w-xs rounded-full bg-slate-200">
          <div className="h-2 rounded-full bg-orange-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {state.progress.done} of {state.progress.total} complete
        </p>
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <PageSectionShell pageId="hire-onboarding" defaultExpanded="all">
        <PageSection id="hire-signature" title="Electronic signature" defaultOpen>
          <FormField label="Legal name (electronic signature)">
            <Input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
          </FormField>
        </PageSection>

        {step === "i9" && (
          <PageSection id="hire-i9" title="Form I-9" defaultOpen>
            <div className="space-y-3">
              <FormField label="Citizenship / work authorization">
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={i9.citizenshipStatus}
                  onChange={(e) => setI9({ ...i9, citizenshipStatus: e.target.value })}
                >
                  <option value="citizen">U.S. citizen</option>
                  <option value="noncitizen_national">U.S. noncitizen national</option>
                  <option value="permanent_resident">Lawful permanent resident</option>
                  <option value="authorized_alien">Authorized to work</option>
                </select>
              </FormField>
              <FormField label="Identity documents presented">
                <Input value={i9.documentList} onChange={(e) => setI9({ ...i9, documentList: e.target.value })} />
              </FormField>
              <FormField label="Start date">
                <Input type="date" value={i9.startDate} onChange={(e) => setI9({ ...i9, startDate: e.target.value })} />
              </FormField>
              <Button className="w-full" disabled={saving || !signatureName} onClick={() => submit({ docType: "I9", data: i9 })}>
                Sign & continue
              </Button>
            </div>
          </PageSection>
        )}

        {step === "w4" && (
          <PageSection id="hire-w4" title="Form W-4" defaultOpen>
            <div className="space-y-3">
              <FormField label="Filing status">
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={w4.filingStatus}
                  onChange={(e) => setW4({ ...w4, filingStatus: e.target.value })}
                >
                  <option value="single">Single</option>
                  <option value="married">Married filing jointly</option>
                  <option value="head">Head of household</option>
                </select>
              </FormField>
              <FormField label="Dependents (count)">
                <Input value={w4.dependents} onChange={(e) => setW4({ ...w4, dependents: e.target.value })} />
              </FormField>
              <FormField label="Extra withholding ($)">
                <Input value={w4.extraWithholding} onChange={(e) => setW4({ ...w4, extraWithholding: e.target.value })} />
              </FormField>
              <Button className="w-full" disabled={saving} onClick={() => submit({ docType: "W4", data: w4 })}>
                Sign & continue
              </Button>
            </div>
          </PageSection>
        )}

        {step === "deposit" && (
          <PageSection id="hire-deposit" title="Direct deposit" defaultOpen>
            <div className="space-y-3">
              <FormField label="Bank name">
                <Input value={deposit.bankName} onChange={(e) => setDeposit({ ...deposit, bankName: e.target.value })} />
              </FormField>
              <FormField label="Routing number">
                <Input value={deposit.routingNumber} onChange={(e) => setDeposit({ ...deposit, routingNumber: e.target.value })} />
              </FormField>
              <FormField label="Account number">
                <Input value={deposit.accountNumber} onChange={(e) => setDeposit({ ...deposit, accountNumber: e.target.value })} />
              </FormField>
              <FormField label="Account type">
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={deposit.accountType}
                  onChange={(e) => setDeposit({ ...deposit, accountType: e.target.value })}
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </FormField>
              <Button className="w-full" disabled={saving} onClick={() => submit({ docType: "DIRECT_DEPOSIT", data: deposit })}>
                Sign & continue
              </Button>
            </div>
          </PageSection>
        )}

        {step === "handbook" && policy && (
          <PageSection
            id={`hire-handbook-${policy.key}`}
            title={policy.title}
            description={`Policy ${policyIndex + 1} of ${HANDBOOK_POLICIES.length}`}
            defaultOpen
          >
            <p className="text-sm text-slate-600">{policy.summary}</p>
            <Button
              className="mt-3 w-full"
              disabled={saving || !signatureName}
              onClick={() => submit({ policyKey: policy.key })}
            >
              I acknowledge — sign as {signatureName || "…"}
            </Button>
          </PageSection>
        )}
      </PageSectionShell>

      <div className="flex justify-center gap-2">
        {["i9", "w4", "deposit", "handbook"].map((s) => (
          <span
            key={s}
            className={cn(
              "h-2 w-2 rounded-full",
              step === s ? "bg-orange-500" : "bg-slate-300"
            )}
          />
        ))}
      </div>
    </div>
  );
}
