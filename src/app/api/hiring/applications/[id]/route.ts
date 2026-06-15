import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { createOnboardingPacket } from "@/lib/hiring/onboarding";
import { sendInterviewReminder, sendOnboardingLink, sendSms } from "@/lib/hiring/sms";
import { onboardingUrl } from "@/lib/hiring/utils";

type RouteParams = { params: Promise<{ id: string }> };

const applicationInclude = {
  applicant: true,
  jobPosting: true,
  interviews: { orderBy: { scheduledAt: "desc" as const }, take: 1 },
  onboardingPacket: {
    include: {
      documents: { select: { docType: true, completedAt: true } },
      acknowledgments: { select: { policyKey: true } },
    },
  },
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error } = await requirePermission(request, "manage_hiring");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  const application = await prisma.application.findFirst({
    where: { id, locationId },
    include: { applicant: true, location: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const data: {
    status?: typeof application.status;
    notes?: string;
    hiredAt?: Date;
  } = {};

  if (body.status) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

  if (body.status === "HIRED") {
    data.hiredAt = new Date();
  }

  const updated = await prisma.application.update({
    where: { id },
    data,
    include: { applicant: true, onboardingPacket: true },
  });

  if (body.status === "HIRED" && !updated.onboardingPacket) {
    await createOnboardingPacket(id);
  }

  if (body.scheduleInterview && body.scheduledAt) {
    const scheduledAt = new Date(body.scheduledAt);
    await prisma.interview.create({
      data: { applicationId: id, scheduledAt, notes: body.interviewNotes?.trim() || null },
    });
    await prisma.application.update({
      where: { id },
      data: { status: "INTERVIEW_SCHEDULED" },
    });
    await sendInterviewReminder(
      locationId,
      application.applicantId,
      application.applicant.phone,
      application.applicant.name,
      scheduledAt,
      application.location.name
    );
    const interview = await prisma.interview.findFirst({
      where: { applicationId: id },
      orderBy: { createdAt: "desc" },
    });
    if (interview) {
      await prisma.interview.update({
        where: { id: interview.id },
        data: { reminderSentAt: new Date() },
      });
    }
  }

  if (body.smsBody?.trim()) {
    await sendSms({
      locationId,
      applicantId: application.applicantId,
      toPhone: application.applicant.phone,
      body: body.smsBody.trim(),
    });
  }

  if (body.resendOnboarding) {
    const packet = await prisma.onboardingPacket.findUnique({
      where: { applicationId: id },
      include: { application: { include: { applicant: true, location: true } } },
    });
    if (packet) {
      await sendOnboardingLink(
        packet.locationId,
        packet.application.applicantId,
        packet.application.applicant.phone,
        packet.application.applicant.name,
        onboardingUrl(packet.token),
        packet.application.location.name
      );
    }
  }

  const final = await prisma.application.findUnique({
    where: { id },
    include: applicationInclude,
  });

  return NextResponse.json(final);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requirePermission(request, "manage_hiring");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);

  const application = await prisma.application.findFirst({
    where: { id, locationId },
    include: {
      applicant: true,
      jobPosting: true,
      interviews: { orderBy: { scheduledAt: "desc" } },
      onboardingPacket: {
        include: {
          documents: { select: { docType: true, completedAt: true } },
          acknowledgments: { select: { policyKey: true } },
        },
      },
    },
  });
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await prisma.smsMessage.findMany({
    where: { locationId, applicantId: application.applicantId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({ application, messages });
}
