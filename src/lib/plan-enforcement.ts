import { prisma } from "./prisma";
import type { PlanId } from "./plans";
import { PLAN_BY_ID } from "./plans";
import type { WorkspaceSnapshot } from "./workspace-cookie";

const TRIAL_DAYS = Number(process.env.PLAN_TRIAL_DAYS ?? 14);

/** Production + Stripe configured → subscription or trial required for full app access. */
export function billingRequired(): boolean {
  if (process.env.PLAN_BILLING_OPTIONAL === "true") return false;
  if (process.env.NODE_ENV !== "production") return false;
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isWithinTrial(createdAt: Date): boolean {
  if (TRIAL_DAYS <= 0) return false;
  return Date.now() - createdAt.getTime() < TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

export function hasActiveBilling(snapshot: WorkspaceSnapshot): boolean {
  if (!snapshot.billingRequired) return true;
  if (snapshot.autopayEnabled) return true;
  if (snapshot.trialActive) return true;
  return false;
}

export function isBillingAllowedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/download") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/api/onboarding") ||
    pathname.startsWith("/api/account") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/webhooks/stripe")
  );
}

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
