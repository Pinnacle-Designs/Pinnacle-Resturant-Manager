"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/form";
import {
  SUBSCRIPTION_CONTRACT_VERSION,
  getSubscriptionContract,
  subscriptionContractPlanSlug,
} from "@/lib/subscription-contracts";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";
import { formatCurrency } from "@/lib/utils";

interface SubscriptionContractModalProps {
  open: boolean;
  onClose: () => void;
  plan: PlanId;
  onAccept: () => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
  continueLabel?: string;
}

export function SubscriptionContractModal({
  open,
  onClose,
  plan,
  onAccept,
  busy = false,
  error = null,
  continueLabel = "Agree & continue to checkout",
}: SubscriptionContractModalProps) {
  const [agreed, setAgreed] = useState(false);
  const contract = getSubscriptionContract(plan);
  const planDef = PLAN_BY_ID[plan];
  const slug = subscriptionContractPlanSlug(plan);

  useEffect(() => {
    if (open) setAgreed(false);
  }, [open, plan]);

  const handleClose = () => {
    if (busy) return;
    setAgreed(false);
    onClose();
  };

  const handleAccept = async () => {
    if (!agreed || busy) return;
    await onAccept();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`${planDef.name} subscription agreement`}
      size="xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {planDef.name} — {formatCurrency(planDef.price)}/mo per location
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Month-to-month service · cancel anytime · version {SUBSCRIPTION_CONTRACT_VERSION}
              </p>
            </div>
          </div>
          <Link
            href={`/terms/subscription/${slug}`}
            target="_blank"
            className="text-sm font-medium text-orange-600 hover:text-orange-500"
          >
            Open full agreement
          </Link>
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
          <p className="text-xs text-slate-500">Effective {contract.effectiveDate}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{contract.title}</h3>

          <div className="mt-6 space-y-6">
            {contract.sections.map((section) => (
              <section key={section.title}>
                <h4 className="text-sm font-semibold text-slate-900">{section.title}</h4>
                <div className="mt-2 space-y-2">
                  {section.paragraphs.map((paragraph, index) => (
                    <p
                      key={`${section.title}-${index}`}
                      className="text-sm leading-relaxed text-slate-600"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={busy}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-sm text-slate-700">
              I have read and agree to the{" "}
              <Link
                href={`/terms/subscription/${slug}`}
                target="_blank"
                className="font-medium text-orange-600 hover:text-orange-500"
              >
                {planDef.name} Subscription Agreement
              </Link>
              , including month-to-month billing at {formatCurrency(planDef.price)}/mo, and
              Pinnacle&apos;s{" "}
              <Link href="/terms" target="_blank" className="font-medium text-orange-600 hover:text-orange-500">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-orange-600 hover:text-orange-500">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={busy} onClick={handleClose}>
              Cancel
            </Button>
            <Button type="button" disabled={!agreed || busy} onClick={() => void handleAccept()}>
              {busy ? "Continuing…" : continueLabel}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function subscriptionCheckoutPayload(plan: PlanId) {
  return {
    termsAccepted: true as const,
    contractVersion: SUBSCRIPTION_CONTRACT_VERSION,
    plan,
  };
}
