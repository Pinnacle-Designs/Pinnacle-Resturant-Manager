import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { LOCATION_COOKIE_NAME } from "@/lib/location";
import { setupDemoWorkspace, type DemoMode } from "@/lib/seed-data";

export async function POST(request: NextRequest) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mode: DemoMode = body.mode === "fresh" ? "fresh" : "seeded";

  try {
    const result = await setupDemoWorkspace(mode);
    const response = NextResponse.json(result);
    response.cookies.set(LOCATION_COOKIE_NAME, result.locationId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  } catch (err) {
    console.error("Demo setup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Demo setup failed" },
      { status: 500 }
    );
  }
}
