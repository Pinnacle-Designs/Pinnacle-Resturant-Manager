import { prisma } from "./prisma";
import type { SessionUser } from "./session";

/** Resolve the staff roster row for a logged-in user at a location. */
export async function resolveStaffMemberForUser(
  user: SessionUser,
  locationId: string
) {
  if (user.locationId && user.locationId !== locationId) {
    return null;
  }

  const byUserId = await prisma.staffMember.findFirst({
    where: { locationId, userId: user.id, active: true },
  });
  if (byUserId) return byUserId;

  const byEmail = await prisma.staffMember.findFirst({
    where: {
      locationId,
      active: true,
      email: user.email.toLowerCase(),
    },
  });
  if (byEmail) {
    if (!byEmail.userId) {
      await prisma.staffMember.update({
        where: { id: byEmail.id },
        data: { userId: user.id },
      });
    }
    return byEmail;
  }

  return null;
}
