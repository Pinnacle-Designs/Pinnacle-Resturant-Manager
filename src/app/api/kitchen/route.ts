import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import {
  getKitchenCostingDashboard,
  recalculateAllRecipeCosts,
} from "@/lib/kitchen/dynamic-costing";
import { generatePrepList } from "@/lib/kitchen/prep-list";
import { getKitchenRecipeSpecs } from "@/lib/kitchen/recipe-specs";
import { prisma } from "@/lib/prisma";
import { parseAllergens, ALLERGEN_LABELS } from "@/lib/kitchen/allergens";

function parseTargetDate(searchParams: URLSearchParams): Date {
  const raw = searchParams.get("date");
  if (!raw) return new Date();
  const parsed = new Date(raw + "T12:00:00");
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_menu");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const targetDate = parseTargetDate(request.nextUrl.searchParams);
  const prepList = await generatePrepList(locationId, targetDate);
  const [costing, recipeSpecs, allergenInsights] = await Promise.all([
    getKitchenCostingDashboard(locationId),
    getKitchenRecipeSpecs(locationId, prepList),
    prisma.businessInsight.findMany({
      where: {
        locationId,
        resolved: false,
        category: "MENU",
        title: { contains: "Allergen" },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    costing,
    prepList,
    recipeSpecs,
    allergenAlerts: allergenInsights,
    allergenLabels: ALLERGEN_LABELS,
  });
}
