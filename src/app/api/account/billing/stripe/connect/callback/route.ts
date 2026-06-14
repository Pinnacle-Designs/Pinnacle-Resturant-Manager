import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseOAuthState } from "@/lib/payments/oauth-state";
import { exchangeStripeConnectCode } from "@/lib/payments/stripe-server";
import { appBaseUrl } from "@/lib/payments/providers";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const base = `${appBaseUrl()}/account?tab=billing`;

  if (errorParam) {
    return NextResponse.redirect(`${base}&pos=stripe-denied`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${base}&pos=stripe-error`);
  }

  const parsed = parseOAuthState<{ locationId: string; userId: string; flow: string }>(state);
  if (!parsed || parsed.flow !== "stripe-connect") {
    return NextResponse.redirect(`${base}&pos=stripe-error`);
  }

  try {
    const token = await exchangeStripeConnectCode(code);
    const accountId = token.stripe_user_id;
    if (!accountId) {
      return NextResponse.redirect(`${base}&pos=stripe-error`);
    }

    await prisma.paymentProviderConnection.upsert({
      where: {
        locationId_purpose: { locationId: parsed.locationId, purpose: "POS" },
      },
      create: {
        locationId: parsed.locationId,
        provider: "STRIPE",
        purpose: "POS",
        accountId,
        status: "connected",
        metadata: JSON.stringify({ scope: token.scope ?? "" }),
      },
      update: {
        provider: "STRIPE",
        accountId,
        status: "connected",
        credential: null,
        metadata: JSON.stringify({ scope: token.scope ?? "" }),
      },
    });

    return NextResponse.redirect(`${base}&pos=stripe-connected`);
  } catch (err) {
    console.error("Stripe Connect callback error:", err);
    return NextResponse.redirect(`${base}&pos=stripe-error`);
  }
}
