import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSubscriptionContract,
  planFromContractSlug,
  subscriptionContractPlanSlug,
} from "@/lib/subscription-contracts";
import { PLANS, type PlanId } from "@/lib/plans";
import { formatCurrency } from "@/lib/utils";

export function generateStaticParams() {
  return PLANS.map((plan) => ({ plan: subscriptionContractPlanSlug(plan.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ plan: string }>;
}): Promise<Metadata> {
  const { plan: slug } = await params;
  const planId = planFromContractSlug(slug);
  if (!planId) {
    return { title: "Subscription Agreement — Pinnacle Restaurant Manager" };
  }
  const contract = getSubscriptionContract(planId);
  return {
    title: `${contract.title} — Pinnacle Restaurant Manager`,
    description: `Month-to-month subscription terms for the Pinnacle ${contract.planName} plan.`,
  };
}

export default async function SubscriptionTermsPage({
  params,
}: {
  params: Promise<{ plan: string }>;
}) {
  const { plan: slug } = await params;
  const planId = planFromContractSlug(slug);
  if (!planId) notFound();

  const contract = getSubscriptionContract(planId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-slate-500">
        Version {contract.version} · Effective {contract.effectiveDate}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{contract.title}</h1>
      <p className="mt-4 text-slate-600 leading-relaxed">
        Month-to-month subscription for the {contract.planName} plan at{" "}
        {formatCurrency(contract.monthlyPrice)}/mo per location. Read this agreement before
        enabling autopay or completing checkout.
      </p>

      <div className="mt-10 space-y-10">
        {contract.sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className="text-slate-600 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <PlanLinks current={planId} />

      <p className="mt-12 text-sm text-slate-500">
        <Link href="/terms" className="text-orange-600 hover:text-orange-500">
          General Terms of Service
        </Link>
        {" · "}
        <Link href="/privacy" className="text-orange-600 hover:text-orange-500">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/" className="text-orange-600 hover:text-orange-500">
          Home
        </Link>
      </p>
    </div>
  );
}

function PlanLinks({ current }: { current: PlanId }) {
  return (
    <div className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm font-medium text-slate-800">Other plan agreements</p>
      <ul className="mt-3 flex flex-wrap gap-3 text-sm">
        {PLANS.filter((p) => p.id !== current).map((plan) => (
          <li key={plan.id}>
            <Link
              href={`/terms/subscription/${subscriptionContractPlanSlug(plan.id)}`}
              className="font-medium text-orange-600 hover:text-orange-500"
            >
              {plan.name} — {formatCurrency(plan.price)}/mo
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
