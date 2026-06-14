import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  loginUser,
  createSessionToken,
  getSessionUserFromRequest,
  parseSessionToken,
  sessionCookieOptions,
  AUTH_COOKIE_NAME,
} from "@/lib/auth";
import { seedDemoUsers } from "@/lib/demo-users";
import { LOCATION_COOKIE_NAME } from "@/lib/location";
import { resolveEmbedPath } from "@/lib/embed-config";
import { applyEmbedAuthCookies, embedCookieFlags } from "@/lib/embed-cookies";
import { setupDemoWorkspace } from "@/lib/seed-data";

export const EMBED_SESSION_PARAM = "_st";

/** True when the iframe parent is on a different origin (needs SameSite=None cookies). */
export function isCrossOriginEmbedRequest(request: NextRequest): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== request.nextUrl.origin) return true;
    } catch {
      /* ignore */
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin !== request.nextUrl.origin) return true;
    } catch {
      /* ignore */
    }
  }

  return false;
}

export async function buildEmbedLaunchResponse(
  request: NextRequest,
  pathParam: string | null
): Promise<NextResponse> {
  const path = resolveEmbedPath(pathParam);
  const forEmbed = isCrossOriginEmbedRequest(request);
  const existing = await getSessionUserFromRequest(request);

  if (existing) {
    const redirectUrl = new URL(`${path}?embed=1`, request.url);
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const locationId =
      request.cookies.get(LOCATION_COOKIE_NAME)?.value ?? existing.locationId ?? "";

    // Cross-origin iframes need _st on every launch so middleware can refresh SameSite=None cookies.
    if (forEmbed && token) {
      redirectUrl.searchParams.set(EMBED_SESSION_PARAM, token);
    }

    const response = NextResponse.redirect(redirectUrl);
    if (token && locationId) {
      applyEmbedAuthCookies(response, request, token, locationId, forEmbed);
    }
    return response;
  }

  await seedDemoUsers();

  const user = await loginUser("owner@pinnacle.com", "demo1234");
  if (!user) {
    return NextResponse.json({ error: "Demo login failed" }, { status: 500 });
  }

  let workspace;
  try {
    workspace = await setupDemoWorkspace("seeded");
  } catch (err) {
    console.error("Embed launch demo setup failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Demo setup failed" },
      { status: 500 }
    );
  }

  const token = await createSessionToken(user);
  const redirectUrl = new URL(`${path}?embed=1`, request.url);

  // Cross-origin iframes often block Set-Cookie on redirect; pass token once in URL.
  if (forEmbed) {
    redirectUrl.searchParams.set(EMBED_SESSION_PARAM, token);
  }

  const response = NextResponse.redirect(redirectUrl);
  applyEmbedAuthCookies(response, request, token, workspace.locationId, forEmbed);
  return response;
}

export async function applyEmbedSessionParam(
  request: NextRequest
): Promise<NextResponse | null> {
  const embedParam = request.nextUrl.searchParams.get("embed");
  const rawToken = request.nextUrl.searchParams.get(EMBED_SESSION_PARAM);
  if (embedParam !== "1" || !rawToken) return null;

  const user = await parseSessionToken(rawToken);
  if (!user) return null;

  const clean = new URL(request.url);
  clean.searchParams.delete(EMBED_SESSION_PARAM);

  const response = NextResponse.redirect(clean);
  // _st is only added for cross-origin embeds — keep SameSite=None through the redirect chain.
  const forEmbed = true;
  const flags = embedCookieFlags(request, forEmbed);
  // Edge-safe: session only. Location cookie is set by /api/embed/launch or resolved server-side.
  response.cookies.set(sessionCookieOptions(rawToken, forEmbed, flags.secure));

  const existingLocation = request.cookies.get(LOCATION_COOKIE_NAME)?.value;
  if (existingLocation) {
    response.cookies.set(LOCATION_COOKIE_NAME, existingLocation, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: flags.sameSite,
      secure: flags.secure,
    });
  }

  return response;
}
