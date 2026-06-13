import { NextRequest, NextResponse } from "next/server";
import { LOCATION_COOKIE_NAME } from "@/lib/location";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = NextResponse.json({ success: true });
  response.cookies.set(LOCATION_COOKIE_NAME, body.locationId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
