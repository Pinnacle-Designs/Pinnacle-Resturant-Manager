import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { getSessionUserFromRequest } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import type { ReportConfig, ReportTemplateRecord } from "@/lib/reports/types";

function serializeTemplate(row: {
  id: string;
  reportId: string;
  name: string;
  description: string | null;
  configJson: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ReportTemplateRecord {
  let config: ReportConfig;
  try {
    config = JSON.parse(row.configJson) as ReportConfig;
  } catch {
    config = { reportId: row.reportId, columns: [], filters: {} };
  }
  return {
    id: row.id,
    reportId: row.reportId,
    name: row.name,
    description: row.description,
    config,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return unauthorizedResponse();

  const locationId = await getLocationIdFromRequest(request);
  const reportId = request.nextUrl.searchParams.get("reportId");

  const templates = await prisma.reportTemplate.findMany({
    where: {
      locationId,
      ...(reportId ? { reportId } : {}),
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(templates.map(serializeTemplate));
}

export async function POST(request: NextRequest) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return unauthorizedResponse();

  try {
    const locationId = await getLocationIdFromRequest(request);
    const body = (await request.json()) as {
      reportId: string;
      name: string;
      description?: string;
      config: ReportConfig;
      isDefault?: boolean;
    };

    if (!body.reportId || !body.name || !body.config) {
      return NextResponse.json({ error: "reportId, name, and config are required" }, { status: 400 });
    }

    if (body.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { locationId, reportId: body.reportId },
        data: { isDefault: false },
      });
    }

    const template = await prisma.reportTemplate.create({
      data: {
        locationId,
        reportId: body.reportId,
        name: body.name,
        description: body.description ?? null,
        configJson: JSON.stringify({ ...body.config, reportId: body.reportId }),
        isDefault: body.isDefault ?? false,
      },
    });

    return NextResponse.json(serializeTemplate(template));
  } catch (err) {
    console.error("Template create error:", err);
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}
