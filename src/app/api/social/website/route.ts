import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import {
  initialWebsiteMetrics,
  metricsToDbFields,
  parseWebsiteUrl,
} from "@/lib/website-analytics";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_social");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const website = await prisma.websiteConnection.findUnique({ where: { locationId } });
  return NextResponse.json(website);
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_social");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  let url: string;
  try {
    url = parseWebsiteUrl(String(body.url || ""));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid URL" },
      { status: 400 }
    );
  }

  const metrics = initialWebsiteMetrics();
  const website = await prisma.websiteConnection.upsert({
    where: { locationId },
    create: {
      locationId,
      url,
      connected: true,
      ...metricsToDbFields(metrics),
    },
    update: {
      url,
      connected: true,
      ...metricsToDbFields(metrics),
    },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "CONNECT",
      entity: "websiteConnection",
      entityId: website.id,
      details: `Connected website ${url} for traffic tracking`,
    },
  });

  return NextResponse.json(website);
}

export async function DELETE(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_social");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const existing = await prisma.websiteConnection.findUnique({ where: { locationId } });

  if (!existing) {
    return NextResponse.json({ error: "No website connected" }, { status: 404 });
  }

  await prisma.websiteConnection.update({
    where: { locationId },
    data: { connected: false },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "DISCONNECT",
      entity: "websiteConnection",
      entityId: existing.id,
      details: `Disconnected website ${existing.url}`,
    },
  });

  return NextResponse.json({ ok: true });
}
