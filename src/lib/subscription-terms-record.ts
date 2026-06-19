import { prisma } from "@/lib/prisma";
import type { PlanId } from "@/lib/plans";
import { SUBSCRIPTION_CONTRACT_VERSION } from "@/lib/subscription-contracts";

export async function recordSubscriptionTermsAcceptance(
  locationId: string,
  plan: PlanId,
  userId: string
) {
  await prisma.location.update({
    where: { id: locationId },
    data: {
      subscriptionTermsAcceptedAt: new Date(),
      subscriptionTermsVersion: SUBSCRIPTION_CONTRACT_VERSION,
      subscriptionTermsPlan: plan,
      subscriptionTermsAcceptedById: userId,
    },
  });
}
