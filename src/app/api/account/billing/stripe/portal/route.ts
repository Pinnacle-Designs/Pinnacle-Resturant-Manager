import { NextRequest } from "next/server";
import { requireSecureAuth } from "@/lib/api-auth";
import { getVerifiedOwnerLocationId } from "@/lib/billing-auth";
import { createStripeBillingPortalSession } from "@/lib/payments/stripe-server";
import { getProviderConnection, stripeConfigured } from "@/lib/payments/providers";
import { privateJsonResponse } from "@/lib/secure-response";

export async function POST(request: NextRequest) {
  const { user, error } = await requireSecureAuth(request);
  if (error) return error;

  if (!stripeConfigured()) {
    return privateJsonResponse(
      { error: "Stripe is not configured on this deployment" },
      { status: 503 }
    );
  }

  const { locationId, error: ownerError } = await getVerifiedOwnerLocationId(user);
  if (ownerError) return ownerError;

  const connection = await getProviderConnection(locationId!, "SUBSCRIPTION");
  if (!connection?.accountId || connection.provider !== "STRIPE") {
    return privateJsonResponse(
      { error: "Connect Stripe before opening the billing portal" },
      { status: 400 }
    );
  }

  const portal = await createStripeBillingPortalSession(connection.accountId);
  return privateJsonResponse({ url: portal.url });
}
