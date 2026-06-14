import { NextRequest, NextResponse } from "next/server";
import {
  loginUser,
  createSessionToken,
  sessionCookieOptions,
  getSessionUserFromRequest,
} from "@/lib/auth";
import { enrichUserWithPlan } from "@/lib/location-plan";
import { LOCATION_COOKIE_NAME } from "@/lib/location";
import { setupDemoWorkspace, type DemoMode } from "@/lib/seed-data";
import { applyEmbedAuthCookies } from "@/lib/embed-cookies";
import { isDemoAccountEmail, isPlanDemoAccountEmail, planDemoLoginEnabled } from "@/lib/demo-users";
import { resolveUserWorkspace } from "@/lib/user-workspace";

export async function GET(request: NextRequest) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ user: null });
  }
  const enriched = await enrichUserWithPlan(user);
  return NextResponse.json({ user: enriched });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = String(body.email || "").trim();
  const user = await loginUser(email, body.password);

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const forEmbed = body.embed === true;
  const demoMode: DemoMode = body.demoMode === "fresh" ? "fresh" : "seeded";
  const useDemoWorkspace = body.demo === true && (body.demoMode === "seeded" || body.demoMode === "fresh");

  if (
    !useDemoWorkspace &&
    isDemoAccountEmail(email) &&
    !(isPlanDemoAccountEmail(email) && planDemoLoginEnabled())
  ) {
    return NextResponse.json(
      {
        error:
          "Demo accounts are for the live demo only. Create your own account or use the embedded demo on the marketing site.",
      },
      { status: 403 }
    );
  }

  if (!useDemoWorkspace && isPlanDemoAccountEmail(email) && !planDemoLoginEnabled()) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  let workspace = null;
  let workspaceError: string | undefined;

  if (useDemoWorkspace) {
    try {
      workspace = await setupDemoWorkspace(demoMode);
    } catch (err) {
      console.error("Demo workspace setup failed:", err);
      workspaceError = err instanceof Error ? err.message : "Demo setup failed";
    }
  } else {
    try {
      workspace = await resolveUserWorkspace(user);
    } catch (err) {
      console.error("User workspace resolution failed:", err);
      workspaceError = err instanceof Error ? err.message : "Could not open your workspace";
    }
  }

  const locationId = workspace?.locationId ?? user.locationId;
  const sessionUser = await enrichUserWithPlan({
    ...user,
    locationId,
  });
  const token = await createSessionToken(sessionUser);

  const response = NextResponse.json({
    user: sessionUser,
    workspace,
    workspaceError,
  });

  if (forEmbed) {
    if (locationId) {
      applyEmbedAuthCookies(response, request, token, locationId, true);
    } else {
      response.cookies.set(sessionCookieOptions(token, true));
    }
  } else {
    response.cookies.set(sessionCookieOptions(token, false));
    if (locationId) {
      response.cookies.set(LOCATION_COOKIE_NAME, locationId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
  }

  return response;
}
