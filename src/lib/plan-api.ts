import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "./auth";
import { getLocationPlan } from "./location-plan";
import type { PlanId } from "./plans";

/** Current plan for an API request — always from the database when possible. */
export async function getRequestPlan(request: NextRequest): Promise<PlanId> {
  const user = await getSessionUserFromRequest(request);
  if (!user?.locationId) return user?.plan ?? "STARTER";
  return getLocationPlan(user.locationId);
}
