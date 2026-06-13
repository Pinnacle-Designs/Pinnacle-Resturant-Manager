import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationId } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "view_insights");
  if (error) return error;

  const locationId = await getLocationId();
  const insights = await prisma.businessInsight.findMany({
    where: {
      locationId,
      resolved: false,
      severity: { in: ["CRITICAL", "HIGH"] },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    insights: insights.map((i) => ({
      title: i.title,
      description: i.description,
      severity: i.severity,
    })),
  });
}
