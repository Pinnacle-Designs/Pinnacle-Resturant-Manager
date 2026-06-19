import { prisma } from "./prisma";
import type { PlanId } from "./plans";
import { PLAN_BY_ID } from "./plans";

export {
  billingRequired,
  hasActiveBilling,
  isBillingAllowedPath,
  isWithinTrial,
} from "./plan-billing";

export async function countActiveStaff(locationId: string): Promise<number> {
  return prisma.staffMember.count({
    where: { locationId, active: true },
  });
}

export async function assertCanAddStaffMember(
  locationId: string,
  plan: PlanId
): Promise<{ ok: true } | { ok: false; message: string; limit: number }> {
  const limit = PLAN_BY_ID[plan]?.maxUsers ?? 3;
  const count = await countActiveStaff(locationId);
  if (count >= limit) {
    return {
      ok: false,
      message: `Your ${PLAN_BY_ID[plan].name} plan includes up to ${limit} team members. Upgrade to add more.`,
      limit,
    };
  }
  return { ok: true };
}
