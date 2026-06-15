import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/hiring/utils";
import { sendSms } from "@/lib/hiring/sms";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body.name || "").trim();
  const phone = normalizePhone(String(body.phone || ""));
  const email = body.email ? String(body.email).trim() : null;
  const applyCode = body.applyCode ? String(body.applyCode).trim().toUpperCase() : null;
  const locationId = body.locationId ? String(body.locationId) : null;

  if (!name || phone.length < 11) {
    return NextResponse.json({ error: "Name and valid phone are required" }, { status: 400 });
  }

  let posting = null;
  let resolvedLocationId = locationId;

  if (applyCode) {
    posting = await prisma.jobPosting.findFirst({
      where: { applyCode, active: true },
      include: { location: true },
    });
    if (!posting) {
      return NextResponse.json({ error: "Invalid job code" }, { status: 404 });
    }
    resolvedLocationId = posting.locationId;
  }

  if (!resolvedLocationId) {
    return NextResponse.json({ error: "Location or job code required" }, { status: 400 });
  }

  const applicant = await prisma.applicant.upsert({
    where: { locationId_phone: { locationId: resolvedLocationId, phone } },
    create: { locationId: resolvedLocationId, name, phone, email },
    update: { name, email: email ?? undefined },
  });

  const application = await prisma.application.create({
    data: {
      locationId: resolvedLocationId,
      applicantId: applicant.id,
      jobPostingId: posting?.id,
      role: posting?.role || String(body.role || "Server"),
      source: body.source === "TEXT_APPLY" ? "TEXT_APPLY" : "WEB",
      status: "NEW",
    },
    include: { applicant: true, location: true },
  });

  const confirmBody = `Thanks ${name.split(" ")[0]}! We received your application for ${application.role} at ${application.location.name}. We'll text you about next steps.`;
  await sendSms({
    locationId: resolvedLocationId,
    applicantId: applicant.id,
    toPhone: phone,
    body: confirmBody,
  });

  return NextResponse.json({
    message: "Application received",
    applicationId: application.id,
  });
}

/** Dev helper: list apply codes */
export async function GET() {
  const postings = await prisma.jobPosting.findMany({
    where: { active: true },
    select: { applyCode: true, title: true, role: true, location: { select: { name: true } } },
    take: 20,
  });
  return NextResponse.json({ postings });
}
