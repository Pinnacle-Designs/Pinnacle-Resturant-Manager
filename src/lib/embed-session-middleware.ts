import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseSessionToken } from "@/lib/session";
import { applyEmbedAuthCookies } from "@/lib/embed-cookies";
import { LOCATION_COOKIE_NAME } from "@/lib/location-constants";
import {
  EMBED_LOCATION_HEADER,
  EMBED_SESSION_HEADER,
  EMBED_SESSION_PARAM,
} from "@/lib/embed-constants";
import { isEmbeddableEmbedParam } from "@/lib/embed-config";

export { EMBED_SESSION_PARAM } from "@/lib/embed-constants";

/** Forward embed session to server components (cookies are often blocked in iframes). */
export function injectEmbedSessionHeaders(
  request: NextRequest,
  token: string,
  locationId?: string
): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(EMBED_SESSION_HEADER, token);
  if (locationId) {
    requestHeaders.set(EMBED_LOCATION_HEADER, locationId);
  }
  return requestHeaders;
}

/**
 * When `_st` is present on an embed URL, refresh cookies but keep `_st` in the URL.
 * Iframes often block third-party cookies — the query param must survive navigation.
 */
export async function applyEmbedSessionParam(
  request: NextRequest
): Promise<NextResponse | null> {
  const rawToken = request.nextUrl.searchParams.get(EMBED_SESSION_PARAM);
  if (!rawToken) return null;

  const embedParam = request.nextUrl.searchParams.get("embed");
  const isEmbedPage = isEmbeddableEmbedParam(embedParam);
  const isEmbedApi =
    request.nextUrl.pathname.startsWith("/api/") && Boolean(rawToken);

  if (!isEmbedPage && !isEmbedApi) return null;

  const user = await parseSessionToken(rawToken);
  if (!user) return null;

  const locationId =
    request.cookies.get(LOCATION_COOKIE_NAME)?.value ?? user.locationId ?? "";

  const response = NextResponse.next({
    request: { headers: injectEmbedSessionHeaders(request, rawToken, locationId) },
  });
  applyEmbedAuthCookies(response, request, rawToken, locationId, true);
  return response;
}
