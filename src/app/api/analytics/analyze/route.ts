import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import {
  ANALYTICS_SECTIONS,
  generateSectionInsights,
  type AnalyticsSection,
} from "@/lib/analytics/section-insights";
import { getRequestPlan } from "@/lib/plan-api";
import { canAccessAnalyticsTab, PLAN_BY_ID, requiredPlanForAnalyticsTab } from "@/lib/plans";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "view_analytics");
  if (error) return error;

  try {
    const body = await request.json();
    const section = body.section as AnalyticsSection;

    if (!section || !ANALYTICS_SECTIONS.includes(section)) {
      return NextResponse.json(
        { error: `Invalid section. Must be one of: ${ANALYTICS_SECTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const plan = await getRequestPlan(request);
    if (!canAccessAnalyticsTab(plan, section)) {
      const required = requiredPlanForAnalyticsTab(section);
      return NextResponse.json(
        {
          error: `Upgrade to ${PLAN_BY_ID[required].name} to unlock this analytics module.`,
          requiredPlan: required,
        },
        { status: 403 }
      );
    }

    const locationId = await getLocationIdFromRequest(request);
    const insights = await generateSectionInsights(locationId, section);

    return NextResponse.json({ section, insights });
  } catch (err) {
    console.error("Analytics section analysis error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
