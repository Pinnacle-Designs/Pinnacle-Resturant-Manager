import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HANDBOOK_POLICIES } from "@/lib/hiring/handbook";
import { packetProgress, finalizeOnboardingIfComplete } from "@/lib/hiring/onboarding";
import type { OnboardingDocType } from "@prisma/client";

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  const packet = await prisma.onboardingPacket.findUnique({
    where: { token },
    include: {
      documents: true,
      acknowledgments: true,
      application: { include: { applicant: true, location: true } },
    },
  });

  if (!packet) {
    return NextResponse.json({ error: "Invalid or expired onboarding link" }, { status: 404 });
  }

  const progress = packetProgress(packet);

  return NextResponse.json({
    applicantName: packet.application.applicant.name,
    role: packet.application.role,
    locationName: packet.application.location.name,
    status: packet.status,
    progress,
    policies: HANDBOOK_POLICIES,
    documents: packet.documents.map((d) => ({
      docType: d.docType,
      completed: !!d.completedAt,
      data: d.completedAt ? JSON.parse(d.data) : null,
    })),
    acknowledgments: packet.acknowledgments.map((a) => ({
      policyKey: a.policyKey,
      policyTitle: a.policyTitle,
      signedAt: a.signedAt.toISOString(),
    })),
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const body = await request.json();

  const packet = await prisma.onboardingPacket.findUnique({
    where: { token },
    include: { application: { include: { applicant: true } } },
  });
  if (!packet) {
    return NextResponse.json({ error: "Invalid onboarding link" }, { status: 404 });
  }
  if (packet.status === "COMPLETE") {
    return NextResponse.json({ error: "Onboarding already complete" }, { status: 400 });
  }

  if (packet.status === "PENDING") {
    await prisma.onboardingPacket.update({
      where: { id: packet.id },
      data: { status: "IN_PROGRESS" },
    });
  }

  const signatureName = String(body.signatureName || packet.application.applicant.name).trim();
  if (!signatureName) {
    return NextResponse.json({ error: "Signature name required" }, { status: 400 });
  }

  if (body.docType && body.data) {
    const docType = body.docType as OnboardingDocType;
    if (!["I9", "W4", "DIRECT_DEPOSIT"].includes(docType)) {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }
    await prisma.onboardingDocument.upsert({
      where: { packetId_docType: { packetId: packet.id, docType } },
      create: {
        packetId: packet.id,
        docType,
        data: JSON.stringify(body.data),
        signatureName,
        completedAt: new Date(),
      },
      update: {
        data: JSON.stringify(body.data),
        signatureName,
        completedAt: new Date(),
      },
    });
  }

  if (body.policyKey) {
    const policy = HANDBOOK_POLICIES.find((p) => p.key === body.policyKey);
    if (!policy) {
      return NextResponse.json({ error: "Unknown policy" }, { status: 400 });
    }
    await prisma.handbookAcknowledgment.upsert({
      where: { packetId_policyKey: { packetId: packet.id, policyKey: policy.key } },
      create: {
        packetId: packet.id,
        policyKey: policy.key,
        policyTitle: policy.title,
        signatureName,
      },
      update: { signatureName, signedAt: new Date() },
    });
  }

  await finalizeOnboardingIfComplete(packet.id);

  const refreshed = await prisma.onboardingPacket.findUnique({
    where: { id: packet.id },
    include: { documents: true, acknowledgments: true },
  });

  return NextResponse.json({
    progress: refreshed ? packetProgress(refreshed) : null,
    status: refreshed?.status ?? packet.status,
  });
}
