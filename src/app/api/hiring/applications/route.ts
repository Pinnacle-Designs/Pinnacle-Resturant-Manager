import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { generateApplyCode, getOrCreateHiringSettings } from "@/lib/hiring/utils";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_hiring");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const status = request.nextUrl.searchParams.get("status");

  const applications = await prisma.application.findMany({
    where: {
      locationId,
      ...(status ? { status: status as never } : {}),
    },
    include: {
      applicant: true,
      jobPosting: true,
      interviews: { orderBy: { scheduledAt: "desc" }, take: 1 },
      onboardingPacket: true,
    },
    orderBy: { appliedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    applications: applications.map((a) => ({
      ...a,
      appliedAt: a.appliedAt.toISOString(),
      hiredAt: a.hiredAt?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
      interviews: a.interviews.map((i) => ({
        ...i,
        scheduledAt: i.scheduledAt.toISOString(),
        reminderSentAt: i.reminderSentAt?.toISOString() ?? null,
      })),
    })),
  });
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_hiring");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  if (body.type === "posting") {
    const posting = await prisma.jobPosting.create({
      data: {
        locationId,
        title: String(body.title || body.role || "Open role"),
        role: String(body.role || "Server"),
        description: body.description?.trim() || null,
        applyCode: body.applyCode?.toUpperCase() || generateApplyCode(),
        active: true,
      },
    });
    return NextResponse.json(posting);
  }

  const phone = String(body.phone || "").replace(/\D/g, "");
  if (!body.name || phone.length < 10) {
    return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
  }

  const normalized = phone.length === 10 ? `+1${phone}` : `+${phone}`;
  const applicant = await prisma.applicant.upsert({
    where: { locationId_phone: { locationId, phone: normalized } },
    create: {
      locationId,
      name: String(body.name),
      phone: normalized,
      email: body.email?.trim() || null,
    },
    update: { name: String(body.name) },
  });

  const application = await prisma.application.create({
    data: {
      locationId,
      applicantId: applicant.id,
      role: String(body.role || "Server"),
      source: "WALK_IN",
      status: "NEW",
      notes: body.notes?.trim() || null,
    },
    include: { applicant: true },
  });

  await getOrCreateHiringSettings(locationId);

  return NextResponse.json(application);
}
