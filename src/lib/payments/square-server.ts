import { appBaseUrl } from "./providers";

function squareBaseUrl(): string {
  return process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

export function squareConfigured(): boolean {
  return Boolean(
    process.env.SQUARE_APPLICATION_ID?.trim() &&
      process.env.SQUARE_APPLICATION_SECRET?.trim()
  );
}

export function createSquareOAuthUrl(state: string): string {
  const appId = process.env.SQUARE_APPLICATION_ID?.trim();
  if (!appId) throw new Error("SQUARE_APPLICATION_ID is not configured");

  const params = new URLSearchParams({
    client_id: appId,
    scope: "MERCHANT_PROFILE_READ PAYMENTS_READ PAYMENTS_WRITE",
    session: "false",
    state,
  });
  return `${squareBaseUrl()}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeSquareOAuthCode(code: string) {
  const appId = process.env.SQUARE_APPLICATION_ID?.trim();
  const secret = process.env.SQUARE_APPLICATION_SECRET?.trim();
  if (!appId || !secret) {
    throw new Error("Square credentials are not configured");
  }

  const res = await fetch(`${squareBaseUrl()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: appId,
      client_secret: secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${appBaseUrl()}/api/account/billing/square/callback`,
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    merchant_id?: string;
    errors?: Array<{ detail?: string }>;
  };

  if (!res.ok) {
    throw new Error(data.errors?.[0]?.detail || "Square authorization failed");
  }

  return data;
}
