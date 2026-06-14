/** Dev-only maintenance routes must stay disabled in production by default (FTC Safeguards / least privilege). */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isAuthSeedRouteEnabled(): boolean {
  return !isProductionRuntime() || process.env.ENABLE_AUTH_SEED === "true";
}

export function devOnlyNotFoundResponse() {
  return { error: "Not found" as const, status: 404 as const };
}
