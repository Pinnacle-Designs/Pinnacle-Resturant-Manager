import { NextResponse } from "next/server";

/** Prevent sensitive account/billing responses from being cached by browsers or proxies. */
export function privateJsonResponse(
  data: unknown,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(data, init);
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  response.headers.set("Pragma", "no-cache");
  return response;
}
