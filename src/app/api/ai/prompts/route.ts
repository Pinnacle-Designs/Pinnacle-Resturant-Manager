import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getRequestPlan } from "@/lib/plan-api";
import {
  dashboardCommandsForPlan,
  isPromptCategoryAllowed,
  promptCategoriesForPlan,
  searchPromptsForPlan,
} from "@/lib/plan-features";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "view_insights");
  if (error) return error;

  const plan = await getRequestPlan(request);
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const categoryId = request.nextUrl.searchParams.get("category") ?? "";

  if (categoryId) {
    if (!isPromptCategoryAllowed(plan, categoryId)) {
      return NextResponse.json(
        { error: "Upgrade your plan to access this prompt library category." },
        { status: 403 }
      );
    }

    const cat = promptCategoriesForPlan(plan).find((c) => c.id === categoryId);
    if (!cat) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: cat.id,
      label: cat.label,
      prompts: cat.prompts,
    });
  }

  const categories = promptCategoriesForPlan(plan);
  const results = q ? searchPromptsForPlan(q, plan, 30) : undefined;

  return NextResponse.json({
    dashboardCommands: dashboardCommandsForPlan(plan),
    categories: categories.map((c) => ({
      id: c.id,
      label: c.label,
      promptCount: c.prompts.length,
      sections: c.sections,
    })),
    prompts: results,
    totalPrompts: categories.reduce((n, c) => n + c.prompts.length, 0),
    plan,
  });
}
