import { NextRequest } from "next/server";
import {
  loginUser,
  getSessionUserFromRequest,
} from "@/lib/auth";
import { prepareAuthSession, attachAuthCookies } from "@/lib/auth-cookies";
import { LOCATION_COOKIE_NAME } from "@/lib/location";
import { setupDemoWorkspace, type DemoMode } from "@/lib/seed-data";
import { applyEmbedAuthCookies } from "@/lib/embed-cookies";
import { isDemoAccountEmail, isPlanDemoAccountEmail, planDemoLoginEnabled, devDemoLoginEnabled, OWNER_DEMO_EMAIL } from "@/lib/demo-users";
import {
  ensureOwnerDemoPostCheckout,
  ownerDemoPostCheckoutRedirect,
} from "@/lib/demo-owner-billing";
import { resolveUserWorkspace } from "@/lib/user-workspace";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { isRateLimited } from "@/lib/rate-limit";
import { privateJsonResponse } from "@/lib/secure-response";

const LOGIN_FAILURE_DELAY_MS = 250;

async function rejectLogin() {
  await new Promise((resolve) => setTimeout(resolve, LOGIN_FAILURE_DELAY_MS));
  return privateJsonResponse({ error: "Invalid email or password" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return privateJsonResponse({ user: null });
  }
  const prepared = await prepareAuthSession(user);
  const response = privateJsonResponse({ user: prepared.sessionUser });
  attachAuthCookies(response, prepared);
  return response;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (isRateLimited(`login:ip:${ip}`, 20, 60_000)) {
    return privateJsonResponse(
      { error: "Too many login attempts. Try again shortly." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();

  if (email && isRateLimited(`login:email:${email}`, 10, 60_000)) {
    return privateJsonResponse(
      { error: "Too many login attempts. Try again shortly." },
      { status: 429 }
    );
  }

  const user = await loginUser(email, body.password);

  if (!user) {
    return rejectLogin();
  }

  const forEmbed = body.embed === true;
  const demoMode: DemoMode = body.demoMode === "fresh" ? "fresh" : "seeded";
  const useDemoWorkspace = body.demo === true && (body.demoMode === "seeded" || body.demoMode === "fresh");

  if (
    !useDemoWorkspace &&
    isDemoAccountEmail(email) &&
    !devDemoLoginEnabled()
  ) {
    return privateJsonResponse(
      {
        error:
          "Demo accounts are for the live demo only. Create your own account or use the embedded demo on the marketing site.",
      },
      { status: 403 }
    );
  }

  if (!useDemoWorkspace && isPlanDemoAccountEmail(email) && !planDemoLoginEnabled()) {
    return rejectLogin();
  }

  let workspace = null;
  let workspaceError: string | undefined;
  let redirectTo: string | undefined;

  if (useDemoWorkspace) {
    try {
      workspace = await setupDemoWorkspace(demoMode);
    } catch (err) {
      console.error("Demo workspace setup failed:", err);
      workspaceError = err instanceof Error ? err.message : "Demo setup failed";
    }
  } else {
    try {
      if (devDemoLoginEnabled() && isDemoAccountEmail(email)) {
        workspace = await setupDemoWorkspace("seeded");
        await prisma.user.update({
          where: { id: user.id },
          data: { locationId: workspace.locationId },
        });
        user.locationId = workspace.locationId;
        if (email === OWNER_DEMO_EMAIL) {
          await ensureOwnerDemoPostCheckout(workspace.locationId, user.id);
          redirectTo = ownerDemoPostCheckoutRedirect(email) ?? undefined;
        }
      } else {
        workspace = await resolveUserWorkspace(user);
      }
    } catch (err) {
      console.error("User workspace resolution failed:", err);
      workspaceError = err instanceof Error ? err.message : "Could not open your workspace";
    }
  }

  const locationId = workspace?.locationId ?? user.locationId;
  const prepared = await prepareAuthSession({
    ...user,
    locationId,
  });

  const response = privateJsonResponse({
    user: prepared.sessionUser,
    workspace,
    workspaceError,
    redirectTo,
  });

  if (forEmbed) {
    if (locationId) {
      applyEmbedAuthCookies(response, request, prepared.sessionToken, locationId, true);
      attachAuthCookies(response, prepared, { forEmbed: true, secure: true });
    } else {
      attachAuthCookies(response, prepared, { forEmbed: true, secure: true });
    }
  } else {
    attachAuthCookies(response, prepared);
    if (locationId) {
      response.cookies.set(LOCATION_COOKIE_NAME, locationId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }
  }

  return response;
}
