import type { NextRequest, NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth";
import { LOCATION_COOKIE_NAME } from "@/lib/location";

export function requestIsHttps(request: NextRequest): boolean {
  if (request.nextUrl.protocol === "https:") return true;
  return request.headers.get("x-forwarded-proto") === "https";
}

export function embedCookieFlags(request: NextRequest, forEmbed: boolean) {
  const https = requestIsHttps(request);
  // SameSite=None requires Secure; modern browsers allow Secure on http://localhost.
  if (forEmbed) {
    return {
      sameSite: "none" as const,
      secure: true,
    };
  }
  return {
    sameSite: "lax" as const,
    secure: https || process.env.NODE_ENV === "production",
  };
}

export function applyEmbedAuthCookies(
  response: NextResponse,
  request: NextRequest,
  token: string,
  locationId: string,
  forEmbed: boolean
) {
  const flags = embedCookieFlags(request, forEmbed);
  response.cookies.set(sessionCookieOptions(token, forEmbed, flags.secure));
  response.cookies.set(LOCATION_COOKIE_NAME, locationId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: flags.sameSite,
    secure: flags.secure,
  });
  return response;
}
