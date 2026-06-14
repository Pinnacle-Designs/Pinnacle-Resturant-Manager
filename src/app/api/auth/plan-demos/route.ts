import { NextResponse } from "next/server";
import {
  PLAN_DEMO_USERS,
  planDemoLoginEnabled,
  seedPlanDemoUsers,
} from "@/lib/demo-users";

export async function GET() {
  if (!planDemoLoginEnabled()) {
    return NextResponse.json({ enabled: false, accounts: [] });
  }

  return NextResponse.json({
    enabled: true,
    password: PLAN_DEMO_USERS[0]?.password ?? "demo1234",
    accounts: PLAN_DEMO_USERS.map((u) => ({
      email: u.email,
      plan: u.plan,
      locationName: u.locationName,
    })),
  });
}

export async function POST() {
  if (!planDemoLoginEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const accounts = await seedPlanDemoUsers();
  return NextResponse.json({
    message: "Plan demo accounts ready",
    accounts,
  });
}
