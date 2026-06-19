import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { getSessionUserFromRequest } from "@/lib/auth";
import { userCan } from "@/lib/permission-resolve";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getReportDefinition } from "@/lib/reports/registry";
import { runReport } from "@/lib/reports/run";
import type { ReportConfig } from "@/lib/reports/types";

export async function POST(request: NextRequest) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = (await request.json()) as { config: ReportConfig };
    const config = body.config;
    if (!config?.reportId) {
      return NextResponse.json({ error: "config.reportId is required" }, { status: 400 });
    }

    const def = getReportDefinition(config.reportId);
    if (!def) {
      return NextResponse.json({ error: "Unknown report" }, { status: 400 });
    }
    if (!(await userCan(user, def.permission))) {
      return forbiddenResponse();
    }

    const locationId = await getLocationIdFromRequest(request);
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { name: true },
    });

    const result = await runReport(locationId, config, location?.name);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Report run error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report failed" },
      { status: 500 }
    );
  }
}
