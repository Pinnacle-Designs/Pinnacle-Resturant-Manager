import { addDays } from "date-fns";
import { prisma } from "./prisma";
import { SUBSCRIPTION_CONTRACT_VERSION } from "./subscription-contracts";
import { OWNER_DEMO_EMAIL } from "./demo-users";

/** Stripe checkout success path for the embed owner demo account. */
export const OWNER_DEMO_POST_CHECKOUT_PATH = "/download?from=checkout";

/** Mark the owner demo workspace as paid so the download step is available. */
export async function ensureOwnerDemoPostCheckout(locationId: string, ownerUserId: string) {
  await prisma.location.update({
    where: { id: locationId },
    data: {
      setupComplete: false,
      onboardingStep: 3,
      autopayEnabled: true,
      billingEmail: "marcus@smokyoakbbq.com",
      paymentBrand: "Visa",
      paymentLast4: "4242",
      paymentExpMonth: 8,
      paymentExpYear: 2028,
      nextBillingDate: addDays(new Date(), 18),
      plan: "PRO",
      subscriptionTermsAcceptedAt: new Date(),
      subscriptionTermsVersion: SUBSCRIPTION_CONTRACT_VERSION,
      subscriptionTermsPlan: "PRO",
      subscriptionTermsAcceptedById: ownerUserId,
    },
  });

  await prisma.paymentProviderConnection.upsert({
    where: { locationId_purpose: { locationId, purpose: "SUBSCRIPTION" } },
    create: {
      locationId,
      provider: "STRIPE",
      purpose: "SUBSCRIPTION",
      status: "connected",
      accountId: "cus_demo_owner",
      metadata: JSON.stringify({
        demo: true,
        subscriptionId: "sub_demo_owner",
        label: "Visa •••• 4242",
      }),
    },
    update: {
      provider: "STRIPE",
      status: "connected",
      accountId: "cus_demo_owner",
      metadata: JSON.stringify({
        demo: true,
        subscriptionId: "sub_demo_owner",
        label: "Visa •••• 4242",
      }),
    },
  });
}

export function ownerDemoPostCheckoutRedirect(email: string): string | null {
  if (email.trim().toLowerCase() === OWNER_DEMO_EMAIL) {
    return OWNER_DEMO_POST_CHECKOUT_PATH;
  }
  return null;
}
