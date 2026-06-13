import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationId } from "@/lib/location";
import { runInsightAnalysis } from "@/lib/ai";
import { requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "view_insights");
  if (error) return error;

  const locationId = await getLocationId();
  const insights = await prisma.businessInsight.findMany({
    where: { locationId },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(insights);
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "view_insights");
  if (error) return error;

  try {
    const locationId = await getLocationId();
    const result = await runInsightAnalysis(locationId);
    const insights = await prisma.businessInsight.findMany({
      where: { locationId, resolved: false },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ ...result, insights });
  } catch (err) {
    console.error("Insight analysis error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
