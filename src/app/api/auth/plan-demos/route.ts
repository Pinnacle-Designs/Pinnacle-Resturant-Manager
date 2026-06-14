import {
  PLAN_DEMO_USERS,
  planDemoLoginEnabled,
  seedPlanDemoUsers,
} from "@/lib/demo-users";
import { privateJsonResponse } from "@/lib/secure-response";

export async function GET() {
  if (!planDemoLoginEnabled()) {
    return privateJsonResponse({ enabled: false, accounts: [] });
  }

  return privateJsonResponse({
    enabled: true,
    accounts: PLAN_DEMO_USERS.map((u) => ({
      email: u.email,
      plan: u.plan,
      locationName: u.locationName,
    })),
  });
}

export async function POST() {
  if (!planDemoLoginEnabled()) {
    return privateJsonResponse({ error: "Not found" }, { status: 404 });
  }

  const accounts = await seedPlanDemoUsers();
  return privateJsonResponse({
    message: "Plan demo accounts ready",
    accounts: accounts.map(({ email, plan, locationName }) => ({
      email,
      plan,
      locationName,
    })),
  });
}
