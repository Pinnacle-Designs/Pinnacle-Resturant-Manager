import { NextRequest } from "next/server";
import { requireSecureAuth } from "@/lib/api-auth";
import { getVerifiedOwnerLocationId } from "@/lib/billing-auth";
import { createOAuthState } from "@/lib/payments/oauth-state";
import { createStripeConnectOAuthUrl } from "@/lib/payments/stripe-server";
import { stripeConnectConfigured } from "@/lib/payments/providers";
import { privateJsonResponse } from "@/lib/secure-response";

export async function GET(request: NextRequest) {
  const { user, error } = await requireSecureAuth(request);
  if (error) return error;

  if (!stripeConnectConfigured()) {
    return privateJsonResponse(
      { error: "Stripe Connect is not configured on this deployment" },
      { status: 503 }
    );
  }

  const { locationId, error: ownerError } = await getVerifiedOwnerLocationId(user);
  if (ownerError) return ownerError;

  const state = createOAuthState({
    locationId: locationId!,
    userId: user!.id,
    flow: "stripe-connect",
  });
  const url = await createStripeConnectOAuthUrl(locationId!, state);
  return privateJsonResponse({ url });
}
