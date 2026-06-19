import type { SubscriptionPlan } from "@prisma/client";

export type PlanId = SubscriptionPlan;

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number;
  period: string;
  bestFor: string;
  blurb: string;
  features: string[];
  maxUsers: number;
  routes: string[];
  featured?: boolean;
}

const STARTER_ROUTES = [
  "/dashboard",
  "/account",
  "/onboarding",
  "/admin",
  "/photos",
  "/menu",
  "/inventory",
  "/staff",
  "/log-book",
  "/timeclock",
  "/tables",
  "/orders",
  "/insights",
  "/analytics",
  "/reports",
];

const GROWTH_ROUTES = [
  ...STARTER_ROUTES,
  "/kitchen",
  "/boh",
  "/kds",
  "/pos",
  "/walk-in",
  "/finances",
];

const PRO_ROUTES = [
  ...GROWTH_ROUTES,
  "/purchase-orders",
  "/loading-dock",
  "/back-office",
  "/crystal-ball",
  "/social",
];

/** Analytics tab ids — Starter gets basics; Growth adds most; Pro gets all 12. */
export const ALL_ANALYTICS_TABS = [
  "executive",
  "sales",
  "food",
  "labor",
  "menu",
  "marketing",
  "customer",
  "operations",
  "purchasing",
  "forecasting",
  "profitability",
  "external",
] as const;

export type AnalyticsTabId = (typeof ALL_ANALYTICS_TABS)[number];

const STARTER_ANALYTICS_TABS: AnalyticsTabId[] = ["executive", "sales", "food", "labor"];

const GROWTH_ANALYTICS_TABS: AnalyticsTabId[] = [
  ...STARTER_ANALYTICS_TABS,
  "menu",
  "operations",
];

const PRO_ANALYTICS_TABS: AnalyticsTabId[] = [...ALL_ANALYTICS_TABS];

const PLAN_ANALYTICS_TABS: Record<PlanId, readonly AnalyticsTabId[]> = {
  STARTER: STARTER_ANALYTICS_TABS,
  GROWTH: GROWTH_ANALYTICS_TABS,
  PRO: PRO_ANALYTICS_TABS,
};

/** API path prefixes that skip plan route checks (auth, billing, search, etc.). */
const API_PLAN_EXEMPT = new Set([
  "auth",
  "account",
  "onboarding",
  "webhooks",
  "admin",
  "embed",
  "search",
  "seed",
  "hiring",
  "pitch-request",
  "external",
]);

/** Map API resource segment → page route (when different). */
const API_RESOURCE_TO_ROUTE: Record<string, string> = {
  "purchase-orders": "/purchase-orders",
  "loading-dock": "/loading-dock",
  "back-office": "/back-office",
  "crystal-ball": "/crystal-ball",
  "log-book": "/log-book",
  "timeclock": "/timeclock",
  "walk-in": "/walk-in",
};

export const PLANS: PlanDefinition[] = [
  {
    id: "STARTER",
    name: "Starter",
    price: 79,
    period: "/mo per location",
    bestFor: "Small shops & single-location cafes",
    blurb: "Dashboard, menu, tables, basic inventory, basic staff, and limited AI.",
    features: [
      "Operations dashboard",
      "Menu & table management",
      "Basic inventory",
      "Staff list & roles",
      "Table floor plan & orders",
      "Basic analytics",
      "Limited AI questions",
    ],
    maxUsers: 3,
    routes: STARTER_ROUTES,
  },
  {
    id: "GROWTH",
    name: "Growth",
    price: 249,
    period: "/mo per location",
    bestFor: "Most independent restaurants",
    blurb: "Your main plan — inventory depth, KDS, labor, menu engineering, and standard AI.",
    features: [
      "Everything in Starter",
      "Full inventory, waste & recipe costing",
      "KDS, split checks & serve flow",
      "Staff scheduling & labor analytics",
      "Menu engineering matrix",
      "Receipt OCR (monthly limit)",
      "AI Command Center (standard)",
    ],
    maxUsers: 10,
    routes: GROWTH_ROUTES,
    featured: true,
  },
  {
    id: "PRO",
    name: "Pro",
    price: 449,
    period: "/mo per location",
    bestFor: "Owners serious about profit",
    blurb: "Advanced AI, full analytics, purchasing, forecasting, integrations, and payroll tools.",
    features: [
      "Everything in Growth",
      "Full 12-tab analytics suite",
      "Advanced AI Command Center",
      "Unlimited receipt OCR",
      "Purchasing & loading dock",
      "Forecasting & marketing ROI",
      "Guest insights & integrations hub",
      "Payroll runs & export tools",
      "Priority support",
    ],
    maxUsers: 25,
    routes: PRO_ROUTES,
  },
];

/** Multi-location group pricing (2–10 locations) — contact sales or self-serve add-on. */
export const GROUP_PRICING = {
  name: "Group",
  firstLocationPrice: 599,
  additionalLocationPrice: 249,
  period: "/mo",
  locationRange: "2–10 locations",
  blurb: "Pro capabilities across a small restaurant group with rolled-up reporting.",
  features: [
    "Everything in Pro",
    "Multi-location dashboard",
    "Compare stores side by side",
    "Brand-level reporting",
    "Cross-location labor & food cost",
    "Owner/admin permissions",
  ],
} as const;

/** Enterprise — custom contracts for franchises and large groups. */
export const ENTERPRISE_PRICING = {
  name: "Enterprise",
  startingPrice: 1500,
  period: "/mo",
  blurb: "Migration, API access, training, custom integrations, white-label, and SLAs.",
  features: [
    "Custom integrations & API access",
    "Data migration & dedicated support",
    "Training & onboarding program",
    "White-label option",
    "Custom reports & AI library",
    "SLA & priority escalation",
  ],
} as const;

export const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<
  PlanId,
  PlanDefinition
>;

export const STARTER_AI_DAILY_LIMIT = 10;

export function parsePlanId(raw: unknown): PlanId | null {
  const value = String(raw || "").trim().toUpperCase();
  if (value === "STARTER" || value === "GROWTH" || value === "PRO") return value;
  return null;
}

export function planRouteSet(plan: PlanId): Set<string> {
  return new Set(PLAN_BY_ID[plan]?.routes ?? STARTER_ROUTES);
}

/** Resolve a URL path to the feature route used for plan checks. */
export function featureRouteFromPathname(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  if (segments[0] === "api") {
    const resource = segments[1];
    if (!resource || API_PLAN_EXEMPT.has(resource)) return null;
    return API_RESOURCE_TO_ROUTE[resource] ?? `/${resource}`;
  }

  return `/${segments[0]}`;
}

export function canAccessPlanRoute(plan: PlanId | null | undefined, pathname: string): boolean {
  const route = featureRouteFromPathname(pathname);
  if (route === null) return true;
  const effective = plan ?? "STARTER";
  return planRouteSet(effective).has(route);
}

export function filterNavForPlan<T extends { href: string }>(
  plan: PlanId | null | undefined,
  items: readonly T[]
): T[] {
  const routes = planRouteSet(plan ?? "STARTER");
  return items.filter((item) => routes.has(item.href));
}

export function analyticsTabsForPlan(plan: PlanId | null | undefined): readonly AnalyticsTabId[] {
  return PLAN_ANALYTICS_TABS[plan ?? "STARTER"] ?? STARTER_ANALYTICS_TABS;
}

export function canAccessAnalyticsTab(
  plan: PlanId | null | undefined,
  tabId: string
): boolean {
  return analyticsTabsForPlan(plan).includes(tabId as AnalyticsTabId);
}

export function requiredPlanForAnalyticsTab(tabId: string): PlanId {
  if (STARTER_ANALYTICS_TABS.includes(tabId as AnalyticsTabId)) return "STARTER";
  if (GROWTH_ANALYTICS_TABS.includes(tabId as AnalyticsTabId)) return "GROWTH";
  return "PRO";
}

/** Growth+ — structured command center scan & dashboard commands. */
export function canUseCommandCenter(plan: PlanId | null | undefined): boolean {
  return plan === "GROWTH" || plan === "PRO";
}

/** Pro — full prompt library & advanced profitability questions. */
export function canUseAdvancedAI(plan: PlanId | null | undefined): boolean {
  return plan === "PRO";
}

export function requiredPlanForRoute(pathname: string): PlanId | null {
  const base = featureRouteFromPathname(pathname);
  if (!base) return null;
  if (STARTER_ROUTES.includes(base)) return null;
  if (PRO_ROUTES.includes(base) && !GROWTH_ROUTES.includes(base)) return "PRO";
  if (GROWTH_ROUTES.includes(base)) return "GROWTH";
  return "STARTER";
}

export function planRank(plan: PlanId): number {
  if (plan === "PRO") return 3;
  if (plan === "GROWTH") return 2;
  return 1;
}

export function meetsPlanRequirement(current: PlanId | null | undefined, required: PlanId): boolean {
  return planRank(current ?? "STARTER") >= planRank(required);
}
