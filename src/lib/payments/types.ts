import type { PaymentProviderKind, PaymentProviderPurpose } from "@prisma/client";

export type SubscriptionProviderId = "manual" | "stripe";
export type PosProviderId = "none" | "stripe" | "square";

export interface ProviderOption {
  id: string;
  name: string;
  description: string;
  purpose: PaymentProviderPurpose;
  configured: boolean;
  connected: boolean;
  accountLabel: string | null;
  status: string | null;
}

export const SUBSCRIPTION_PROVIDER_LABELS: Record<SubscriptionProviderId, string> = {
  manual: "Manual entry",
  stripe: "Stripe",
};

export const POS_PROVIDER_LABELS: Record<PosProviderId, string> = {
  none: "Not connected",
  stripe: "Stripe",
  square: "Square",
};

export function kindToSubscriptionId(
  provider: PaymentProviderKind | null | undefined
): SubscriptionProviderId {
  if (provider === "STRIPE") return "stripe";
  return "manual";
}

export function kindToPosId(provider: PaymentProviderKind | null | undefined): PosProviderId {
  if (provider === "STRIPE") return "stripe";
  if (provider === "SQUARE") return "square";
  return "none";
}
