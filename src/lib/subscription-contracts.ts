import type { PlanId } from "./plans";
import { PLAN_BY_ID, parsePlanId } from "./plans";

/** Bump when subscription agreement text changes materially. */
export const SUBSCRIPTION_CONTRACT_VERSION = "2026-06-19";

export interface SubscriptionContractSection {
  title: string;
  paragraphs: string[];
}

export interface SubscriptionContract {
  plan: PlanId;
  planName: string;
  monthlyPrice: number;
  version: string;
  effectiveDate: string;
  title: string;
  sections: SubscriptionContractSection[];
}

const COMPANY = "Pinnacle Designs LLC";
const PRODUCT = "Pinnacle Restaurant Manager";

function sharedSections(plan: PlanId): SubscriptionContractSection[] {
  const def = PLAN_BY_ID[plan];
  return [
    {
      title: "1. Parties & agreement",
      paragraphs: [
        `This Subscription Agreement ("Agreement") is between ${COMPANY} ("Pinnacle", "we", "us") and the business entity or individual registering for the service ("Customer", "you"). By enabling autopay or completing checkout, you agree on behalf of yourself and your restaurant location.`,
        `This Agreement supplements our general Terms of Service and Privacy Policy. If there is a conflict regarding subscription billing or plan features, this Agreement controls for those topics.`,
      ],
    },
    {
      title: "2. Service & plan",
      paragraphs: [
        `Pinnacle provides ${PRODUCT}, a cloud-hosted restaurant management platform. Your selected plan is ${def.name} at $${def.price} USD per location per month.`,
        def.blurb,
        `Included capabilities for the ${def.name} plan:`,
        ...def.features.map((f) => `• ${f}`),
        `Feature availability may evolve as we improve the product. We will not materially remove core features included in your plan without reasonable notice, except where required for security, legal compliance, or discontinuation of a third-party integration.`,
      ],
    },
    {
      title: "3. Month-to-month billing",
      paragraphs: [
        `Your subscription is month-to-month. Each billing period begins on the date autopay is first enabled (or your trial converts) and renews automatically every calendar month until canceled.`,
        `You authorize Pinnacle to charge the payment method on file for the recurring monthly fee, applicable taxes, and any approved add-ons. Charges are processed through Stripe or another PCI-compliant processor; card data is not stored on Pinnacle servers when using hosted checkout.`,
        `Fees are billed in advance for each monthly period. If a payment fails, we may retry, suspend access after notice, or downgrade features until the account is brought current.`,
        `Fees are non-refundable except where required by law. Plan changes take effect according to your billing cycle; upgrades may be prorated at our discretion.`,
      ],
    },
    {
      title: "4. Cancellation & termination",
      paragraphs: [
        `You may cancel at any time through Account → Billing (Stripe customer portal when connected) or by contacting support. Cancellation stops future renewals; access continues through the end of the paid period unless otherwise stated.`,
        `We may suspend or terminate service for material breach (including non-payment, misuse, or unlawful activity) after reasonable notice when practicable.`,
        `Upon termination, you may export operational data during any notice period we provide. We may delete or anonymize data according to our Privacy Policy and retention schedule.`,
      ],
    },
    {
      title: "5. Customer responsibilities",
      paragraphs: [
        `You are responsible for accurate business information, user access controls, and compliance with labor, food safety, tax, and payment regulations in your jurisdiction.`,
        `AI insights, forecasts, OCR output, and analytics are decision-support tools — not legal, tax, accounting, or food-safety advice. You remain responsible for operational and compliance decisions.`,
        `Guest card payments processed through your connected Square or Stripe Connect account are governed by those providers' terms.`,
      ],
    },
    {
      title: "6. Data & confidentiality",
      paragraphs: [
        `You retain ownership of your operational data. You grant Pinnacle a limited license to host, process, and display that data solely to provide and improve the service.`,
        `We implement reasonable administrative, technical, and organizational safeguards. See our Privacy Policy for details on collection, subprocessors, and data subject rights.`,
      ],
    },
    {
      title: "7. Warranties & liability",
      paragraphs: [
        `The service is provided "as is" and "as available" to the maximum extent permitted by law. We disclaim implied warranties of merchantability, fitness for a particular purpose, and non-infringement.`,
        `To the maximum extent permitted by law, Pinnacle's total liability arising from this Agreement is limited to the fees you paid to Pinnacle for the ${def.name} plan in the twelve (12) months before the claim. We are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits or data.`,
      ],
    },
    {
      title: "8. General",
      paragraphs: [
        `This Agreement is governed by the laws of the State of Texas, USA, without regard to conflict-of-law rules, except where mandatory consumer protection laws apply in your jurisdiction.`,
        `We may update this Agreement by posting a new version and bumping the contract version. Continued use after the effective date constitutes acceptance. Material changes to pricing or billing terms require your renewed consent before the next charge.`,
        `Questions: support@pinnacle.app · ${COMPANY}`,
      ],
    },
  ];
}

function planSpecificSection(plan: PlanId): SubscriptionContractSection {
  switch (plan) {
    case "STARTER":
      return {
        title: "Starter plan — usage limits",
        paragraphs: [
          "The Starter plan supports up to 3 user seats per location unless otherwise agreed in writing.",
          "Analytics are limited to executive, sales, food, and labor tabs. AI question volume is limited per day as described in the product.",
          "Kitchen display (KDS), advanced POS flows, purchasing, loading dock, payroll export, and Pro-only integrations are not included.",
        ],
      };
    case "GROWTH":
      return {
        title: "Growth plan — usage limits",
        paragraphs: [
          "The Growth plan supports up to 10 user seats per location unless otherwise agreed in writing.",
          "Includes KDS, labor scheduling, menu engineering, and standard AI Command Center features.",
          "Receipt OCR is subject to monthly fair-use limits. Advanced analytics tabs, purchasing, loading dock, and Pro-only modules require a Pro upgrade.",
        ],
      };
    case "PRO":
      return {
        title: "Pro plan — usage limits",
        paragraphs: [
          "The Pro plan supports up to 25 user seats per location unless otherwise agreed in writing.",
          "Includes the full 12-tab analytics suite, advanced AI, unlimited receipt OCR (fair use), purchasing, loading dock, forecasting, integrations hub, and payroll tools.",
          "Priority support means commercially reasonable best-effort response times during business hours; it is not a guaranteed SLA unless covered by a separate enterprise agreement.",
        ],
      };
  }
}

export function getSubscriptionContract(plan: PlanId): SubscriptionContract {
  const def = PLAN_BY_ID[plan];
  const planSection = planSpecificSection(plan);
  const sections = [...sharedSections(plan)];
  sections.splice(2, 0, planSection);

  return {
    plan,
    planName: def.name,
    monthlyPrice: def.price,
    version: SUBSCRIPTION_CONTRACT_VERSION,
    effectiveDate: "June 19, 2026",
    title: `${def.name} Subscription Agreement`,
    sections,
  };
}

export function subscriptionContractPlanSlug(plan: PlanId): string {
  return plan.toLowerCase();
}

export function planFromContractSlug(slug: string): PlanId | null {
  return parsePlanId(slug.toUpperCase());
}

export function validateSubscriptionTermsAcceptance(
  body: Record<string, unknown>,
  expectedPlan: PlanId
): { ok: true } | { ok: false; error: string } {
  if (body.termsAccepted !== true) {
    return {
      ok: false,
      error: "You must accept the subscription agreement before checkout.",
    };
  }

  if (body.contractVersion !== SUBSCRIPTION_CONTRACT_VERSION) {
    return {
      ok: false,
      error: "Please review and accept the current subscription agreement.",
    };
  }

  const acceptedPlan = parsePlanId(body.plan);
  if (!acceptedPlan || acceptedPlan !== expectedPlan) {
    return {
      ok: false,
      error: "Subscription agreement does not match your current plan.",
    };
  }

  return { ok: true };
}
