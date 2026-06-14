import { clearSessionCookieOptions } from "@/lib/auth";
import { LOCATION_COOKIE_NAME } from "@/lib/location";
import { privateJsonResponse } from "@/lib/secure-response";

export async function POST() {
  const response = privateJsonResponse({ success: true });
  response.cookies.set(clearSessionCookieOptions());
  response.cookies.set(LOCATION_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return response;
}
