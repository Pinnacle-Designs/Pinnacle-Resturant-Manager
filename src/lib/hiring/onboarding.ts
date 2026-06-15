import { prisma } from "@/lib/prisma";
import { HANDBOOK_POLICIES } from "./handbook";
import { generateOnboardingToken, onboardingUrl } from "./utils";
import { sendOnboardingLink } from "./sms";
import type { OnboardingDocType } from "@prisma/client";

const REQUIRED_DOCS: OnboardingDocType[] = ["I9", "W4", "DIRECT_DEPOSIT"];

export async function createOnboardingPacket(applicationId: string) {
  const existing = await prisma.onboardingPacket.findUnique({
    where: { applicationId },
  });
  if (existing) return existing;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicant: true, location: true },
  });
  if (!application) throw new Error("Application not found");

  const token = generateOnboardingToken();
  const packet = await prisma.onboardingPacket.create({
    data: {
      locationId: application.locationId,
      applicationId,
      token,
      status: "PENDING",
      documents: {
        create: REQUIRED_DOCS.map((docType) => ({
          docType,
          data: "{}",
        })),
      },
    },
  });

  const url = onboardingUrl(token);
  await sendOnboardingLink(
    application.locationId,
    application.applicantId,
    application.applicant.phone,
    application.applicant.name,
    url,
    application.location.name
  );

  return packet;
}

export function packetProgress(packet: {
  documents: { docType: OnboardingDocType; completedAt: Date | null }[];
  acknowledgments: { policyKey: string }[];
}) {
  const docsDone = REQUIRED_DOCS.filter((d) =>
    packet.documents.some((doc) => doc.docType === d && doc.completedAt)
  ).length;
  const policiesDone = HANDBOOK_POLICIES.filter((p) =>
    packet.acknowledgments.some((a) => a.policyKey === p.key)
  ).length;
  const total = REQUIRED_DOCS.length + HANDBOOK_POLICIES.length;
  const done = docsDone + policiesDone;
  return { done, total, complete: done >= total };
}

export async function finalizeOnboardingIfComplete(packetId: string) {
  const packet = await prisma.onboardingPacket.findUnique({
    where: { id: packetId },
    include: { documents: true, acknowledgments: true, application: { include: { applicant: true } } },
  });
  if (!packet) return null;

  const { complete } = packetProgress(packet);
  if (!complete) return packet;

  const staff = await prisma.staffMember.create({
    data: {
      locationId: packet.locationId,
      name: packet.application.applicant.name,
      role: packet.application.role,
      email: packet.application.applicant.email,
      phone: packet.application.applicant.phone,
      active: true,
    },
  });

  return prisma.onboardingPacket.update({
    where: { id: packetId },
    data: {
      status: "COMPLETE",
      staffMemberId: staff.id,
      completedAt: new Date(),
    },
  });
}
