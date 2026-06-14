import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { getSessionUserFromRequest } from "@/lib/auth";
import { isManagement } from "@/lib/permissions";
import { seedDemoUsers } from "@/lib/demo-users";
import { seedLocationData } from "@/lib/seed-data";
import { getLocationId } from "@/lib/location";

async function runSeed(request?: NextRequest) {
  await seedDemoUsers();
  const locationId = request
    ? await getLocationIdFromRequest(request)
    : await getLocationId();
  return seedLocationData(locationId);
}

function seedHtml(result: Awaited<ReturnType<typeof seedLocationData>>) {
  const status = result.alreadySeeded ? "Already seeded" : result.partial ? "Partial seed" : "Success";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Pinnacle — Seed</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; color: #1e293b; }
    h1 { font-size: 1.5rem; }
    .ok { color: #16a34a; }
    .warn { color: #d97706; }
    a { color: #ea580c; }
    code { background: #f1f5f9; padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.875rem; }
  </style>
</head>
<body>
  <h1 class="${result.alreadySeeded ? "warn" : "ok"}">${status}</h1>
  <p>${result.message}</p>
  <p>Demo login users were refreshed (password: <code>demo1234</code>).</p>
  <p><a href="/dashboard">Go to dashboard</a> · <a href="/login">Login</a> · <a href="/">Website</a></p>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: "Log in as owner or manager, then visit /api/seed again.",
      },
      { status: 401 }
    );
  }
  if (!isManagement(user.role)) {
    return NextResponse.json(
      { error: "Forbidden", hint: "Only owner and manager can seed sample data." },
      { status: 403 }
    );
  }

  try {
    const result = await runSeed(request);
    const accept = request.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      return new NextResponse(seedHtml(result), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManagement(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await runSeed(request);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}
