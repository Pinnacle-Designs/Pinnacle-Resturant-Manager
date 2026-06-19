import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { getSessionUserFromRequest } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import type { ReportConfig } from "@/lib/reports/types";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  try {
    const locationId = await getLocationIdFromRequest(request);
    const existing = await prisma.reportTemplate.findFirst({
      where: { id, locationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      description?: string;
      config?: ReportConfig;
      isDefault?: boolean;
    };

    if (body.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { locationId, reportId: existing.reportId },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.reportTemplate.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.config
          ? { configJson: JSON.stringify({ ...body.config, reportId: existing.reportId }) }
          : {}),
        ...(body.isDefault != null ? { isDefault: body.isDefault } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Template update error:", err);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);

  const existing = await prisma.reportTemplate.findFirst({ where: { id, locationId } });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await prisma.reportTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
