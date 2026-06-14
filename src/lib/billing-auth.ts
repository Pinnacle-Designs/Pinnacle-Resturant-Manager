import { prisma } from "./prisma";
import type { SessionUser } from "./session";
import { forbiddenResponse, unauthorizedResponse } from "./api-auth";

/** Billing is always scoped to the owner's registered location — never the switchable location cookie. */
export async function getVerifiedOwnerLocationId(user: SessionUser | null) {
  if (!user) {
    return { locationId: null as string | null, error: unauthorizedResponse() };
  }

  if (user.role !== "OWNER" || !user.locationId) {
    return { locationId: null, error: forbiddenResponse() };
  }

  const owner = await prisma.user.findFirst({
    where: {
      id: user.id,
      locationId: user.locationId,
      role: "OWNER",
      active: true,
    },
    select: { locationId: true },
  });

  if (!owner?.locationId) {
    return { locationId: null, error: forbiddenResponse() };
  }

  return { locationId: owner.locationId, error: null };
}

export function userManagesBilling(user: SessionUser): boolean {
  return user.role === "OWNER" && Boolean(user.locationId);
}
