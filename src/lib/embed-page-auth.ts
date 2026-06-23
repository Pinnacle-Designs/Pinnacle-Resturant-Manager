import { headers } from "next/headers";
import { enrichUserWithPlan, getEnrichedSessionUser } from "./location-plan";
import type { PlanId } from "./plans";
import { parseSessionToken, type SessionUser } from "./session";
import { EMBED_SESSION_HEADER } from "./embed-constants";

/** Resolve session user for SSR pages — cookies, embed middleware header, or `_st`. */
export async function getEmbedAwarePageUser(): Promise<SessionUser | null> {
  const user = await getEnrichedSessionUser();
  if (user) return user;

  const hdrs = await headers();
  const token = hdrs.get(EMBED_SESSION_HEADER);
  if (!token) return null;

  const parsed = await parseSessionToken(token);
  if (!parsed) return null;
  return enrichUserWithPlan(parsed);
}

/** Demo embed always runs Smoky Oak BBQ on the Pro plan. */
export async function getDemoPagePlan(): Promise<PlanId> {
  const user = await getEmbedAwarePageUser();
  return user?.plan ?? "PRO";
}
