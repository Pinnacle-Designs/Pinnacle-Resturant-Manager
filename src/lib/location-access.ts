import type { NextRequest } from "next/server";
import { isProductionRuntime } from "./dev-routes";
import { isPlatformAdmin } from "./platform-admin";
import type { SessionUser } from "./session";

/** Whether the signed-in user may read/write data for this location. */
export function canUserAccessLocation(
  user: Pick<SessionUser, "locationId" | "email" | "isPlatformAdmin">,
  locationId: string
): boolean {
  if (isPlatformAdmin(user)) return true;
  return Boolean(user.locationId && user.locationId === locationId);
}

/**
 * Resolve tenant location for an API request.
 * In production, ignores x-location-id unless it matches the user's location.
 */
export async function resolveAuthorizedLocationId(
  request: NextRequest,
  user: SessionUser | null,
  cookieLocationId: string | undefined
): Promise<string | null> {
  const headerId = request.headers.get("x-location-id")?.trim() || null;

  if (user && isProductionRuntime()) {
    if (cookieLocationId && canUserAccessLocation(user, cookieLocationId)) {
      return cookieLocationId;
    }
    return user.locationId ?? null;
  }

  if (user) {
    if (headerId && !isProductionRuntime()) {
      return headerId;
    }
    if (headerId && canUserAccessLocation(user, headerId)) {
      return headerId;
    }
    if (cookieLocationId && canUserAccessLocation(user, cookieLocationId)) {
      return cookieLocationId;
    }
    return user.locationId ?? null;
  }

  if (headerId) return headerId;
  if (cookieLocationId) return cookieLocationId;
  return null;
}
