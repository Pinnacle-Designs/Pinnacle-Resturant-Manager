import {
  DASHBOARD_AI_COMMANDS,
  MANAGER_PROMPT_CATEGORIES,
  searchPrompts,
  type ManagerPromptCategory,
} from "@/lib/ai/manager-prompts";
import type { AnalyticsPayload } from "@/lib/analytics/types";
import {
  ALL_ANALYTICS_TABS,
  analyticsTabsForPlan,
  canUseCommandCenter,
  type AnalyticsTabId,
  type PlanId,
} from "@/lib/plans";

/** Analytics payload keys gated by tab id. */
const ANALYTICS_TAB_PAYLOAD_KEY: Record<AnalyticsTabId, keyof AnalyticsPayload> = {
  executive: "executive",
  sales: "sales",
  food: "foodCost",
  labor: "labor",
  menu: "menuEngineering",
  marketing: "marketing",
  customer: "customerExperience",
  operations: "operations",
  purchasing: "purchasing",
  forecasting: "forecasting",
  profitability: "profitability",
  external: "externalFactors",
};

const ANALYTICS_META_KEYS: (keyof AnalyticsPayload)[] = [
  "generatedAt",
  "periodDays",
  "aiInsights",
  "coverage",
];

export function filterAnalyticsPayloadForPlan(
  payload: AnalyticsPayload,
  plan: PlanId
): AnalyticsPayload {
  const allowedTabs = new Set(analyticsTabsForPlan(plan));
  const allowedKeys = new Set<keyof AnalyticsPayload>(ANALYTICS_META_KEYS);

  for (const tab of ALL_ANALYTICS_TABS) {
    if (allowedTabs.has(tab)) {
      allowedKeys.add(ANALYTICS_TAB_PAYLOAD_KEY[tab]);
    }
  }

  const filtered = {} as AnalyticsPayload;
  for (const key of allowedKeys) {
    if (key in payload) {
      (filtered as unknown as Record<string, unknown>)[key] = payload[key];
    }
  }

  if (filtered.coverage) {
    filtered.coverage = {
      sections: filtered.coverage.sections.filter((section) =>
        allowedTabs.has(section.id as AnalyticsTabId)
      ),
    };
  }

  return filtered;
}

export function promptCategoriesForPlan(plan: PlanId): ManagerPromptCategory[] {
  const allowedSections = new Set(analyticsTabsForPlan(plan));
  return MANAGER_PROMPT_CATEGORIES.filter((category) =>
    category.sections.some((section) => allowedSections.has(section as AnalyticsTabId))
  );
}

export function dashboardCommandsForPlan(plan: PlanId) {
  if (!canUseCommandCenter(plan)) return [];
  return DASHBOARD_AI_COMMANDS;
}

export function searchPromptsForPlan(query: string, plan: PlanId, limit = 30) {
  const allowedCategoryIds = new Set(promptCategoriesForPlan(plan).map((c) => c.id));
  return searchPrompts(query, limit * 2)
    .filter((prompt) => allowedCategoryIds.has(prompt.categoryId))
    .slice(0, limit);
}

export function isPromptCategoryAllowed(plan: PlanId, categoryId: string): boolean {
  return promptCategoriesForPlan(plan).some((category) => category.id === categoryId);
}
