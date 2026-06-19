import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { userCan } from "@/lib/permission-resolve";
import { unauthorizedResponse } from "@/lib/api-auth";
import { REPORT_REGISTRY, listReportsByCategory } from "@/lib/reports/registry";

export async function GET(request: NextRequest) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return unauthorizedResponse();

  const accessible = REPORT_REGISTRY.filter((r) => userCan(user, r.permission));
  const grouped = listReportsByCategory();
  const filteredGrouped: Record<string, typeof accessible> = {};
  for (const [category, reports] of Object.entries(grouped)) {
    const items = reports.filter((r) => accessible.some((a) => a.id === r.id));
    if (items.length > 0) filteredGrouped[category] = items;
  }

  return NextResponse.json({
    reports: accessible,
    byCategory: filteredGrouped,
  });
}
