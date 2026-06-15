import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { getOrCreateHiringSettings } from "@/lib/hiring/utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_hiring");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const settings = await getOrCreateHiringSettings(locationId);
  let postings = await prisma.jobPosting.findMany({
    where: { locationId, active: true },
    orderBy: { createdAt: "desc" },
  });

  if (postings.length === 0) {
    const { generateApplyCode } = await import("@/lib/hiring/utils");
    const created = await prisma.jobPosting.create({
      data: {
        locationId,
        title: "Now hiring — all positions",
        role: "Server",
        description: "Join our team! Text APPLY or use the web form.",
        applyCode: generateApplyCode(),
        active: true,
      },
    });
    postings = [created];
  }

  return NextResponse.json({ settings, postings });
}

export async function PUT(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_hiring");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  const settings = await prisma.hiringSettings.upsert({
    where: { locationId },
    create: {
      locationId,
      applyPhone: body.applyPhone?.trim() || null,
      applyKeyword: body.applyKeyword?.trim() || "APPLY",
      smsEnabled: Boolean(body.smsEnabled),
    },
    update: {
      applyPhone: body.applyPhone?.trim() || null,
      applyKeyword: body.applyKeyword?.trim() || "APPLY",
      smsEnabled: Boolean(body.smsEnabled),
    },
  });

  return NextResponse.json(settings);
}
