import { NextRequest } from "next/server";
import { requireSecureAuth } from "@/lib/api-auth";
import { getVerifiedOwnerLocationId } from "@/lib/billing-auth";
import { createOAuthState } from "@/lib/payments/oauth-state";
import { createSquareOAuthUrl, squareConfigured } from "@/lib/payments/square-server";
import { privateJsonResponse } from "@/lib/secure-response";

export async function GET(request: NextRequest) {
  const { user, error } = await requireSecureAuth(request);
  if (error) return error;

  if (!squareConfigured()) {
    return privateJsonResponse(
      { error: "Square is not configured on this deployment" },
      { status: 503 }
    );
  }

  const { locationId, error: ownerError } = await getVerifiedOwnerLocationId(user);
  if (ownerError) return ownerError;

  const state = createOAuthState({
    locationId: locationId!,
    userId: user!.id,
    flow: "square-pos",
  });
  const url = createSquareOAuthUrl(state);
  return privateJsonResponse({ url });
}
