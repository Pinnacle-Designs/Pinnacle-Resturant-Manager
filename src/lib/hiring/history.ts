import { prisma } from "@/lib/prisma";
import type { RehireStatus } from "@prisma/client";

export type HiringHistoryKind = "APPLICANT" | "FORMER_EMPLOYEE";

export type HiringHistoryRecord = {
  id: string;
  kind: HiringHistoryKind;
  applicantId: string | null;
  staffMemberId: string | null;
  applicationId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  outcome: string;
  outcomeDate: string;
  applicationNotes: string | null;
  terminationReason: string | null;
  rating: number | null;
  rehirable: RehireStatus;
  talentNotes: string | null;
};

export type HistorySort = "rating" | "name" | "date";

const CLOSED_STATUSES = ["REJECTED", "WITHDRAWN"] as const;

function sortRecords(records: HiringHistoryRecord[], sort: HistorySort) {
  const copy = [...records];
  if (sort === "rating") {
    copy.sort((a, b) => {
      const ar = a.rating ?? -1;
      const br = b.rating ?? -1;
      if (br !== ar) return br - ar;
      return a.name.localeCompare(b.name);
    });
  } else if (sort === "date") {
    copy.sort((a, b) => b.outcomeDate.localeCompare(a.outcomeDate));
  } else {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  return copy;
}

export async function fetchHiringHistory(
  locationId: string,
  sort: HistorySort = "rating"
): Promise<HiringHistoryRecord[]> {
  const [closedApps, inactiveStaff, onboardingLinks] = await Promise.all([
    prisma.application.findMany({
      where: {
        locationId,
        status: { in: [...CLOSED_STATUSES] },
      },
      include: { applicant: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.staffMember.findMany({
      where: { locationId, active: false },
      orderBy: { terminatedAt: "desc" },
    }),
    prisma.onboardingPacket.findMany({
      where: {
        locationId,
        staffMemberId: { not: null },
      },
      select: {
        staffMemberId: true,
        application: { select: { applicantId: true } },
      },
    }),
  ]);

  const applicantIdsWithStaffRecord = new Set<string>();
  for (const link of onboardingLinks) {
    if (link.staffMemberId && link.application?.applicantId) {
      const staff = inactiveStaff.find((s) => s.id === link.staffMemberId);
      if (staff) applicantIdsWithStaffRecord.add(link.application.applicantId);
    }
  }

  const seenApplicants = new Set<string>();
  const records: HiringHistoryRecord[] = [];

  for (const app of closedApps) {
    if (seenApplicants.has(app.applicantId)) continue;
    if (applicantIdsWithStaffRecord.has(app.applicantId)) continue;
    seenApplicants.add(app.applicantId);

    const applicant = app.applicant;
    records.push({
      id: `applicant-${applicant.id}`,
      kind: "APPLICANT",
      applicantId: applicant.id,
      staffMemberId: null,
      applicationId: app.id,
      name: applicant.name,
      phone: applicant.phone,
      email: applicant.email,
      role: app.role,
      outcome: app.status === "REJECTED" ? "Not hired" : "Withdrew",
      outcomeDate: app.updatedAt.toISOString(),
      applicationNotes: app.notes,
      terminationReason: null,
      rating: applicant.rating,
      rehirable: applicant.rehirable,
      talentNotes: applicant.talentNotes,
    });
  }

  for (const staff of inactiveStaff) {
    records.push({
      id: `staff-${staff.id}`,
      kind: "FORMER_EMPLOYEE",
      applicantId: null,
      staffMemberId: staff.id,
      applicationId: null,
      name: staff.name,
      phone: staff.phone,
      email: staff.email,
      role: staff.role,
      outcome: "Former employee",
      outcomeDate: (staff.terminatedAt ?? staff.updatedAt).toISOString(),
      applicationNotes: null,
      terminationReason: staff.terminationReason,
      rating: staff.rating,
      rehirable: staff.rehirable,
      talentNotes: staff.talentNotes,
    });
  }

  return sortRecords(records, sort);
}

export async function updateHiringHistoryTalent(input: {
  kind: HiringHistoryKind;
  applicantId?: string | null;
  staffMemberId?: string | null;
  locationId: string;
  rating?: number | null;
  rehirable?: RehireStatus;
  talentNotes?: string | null;
}) {
  const rating =
    input.rating === undefined
      ? undefined
      : input.rating === null
        ? null
        : Math.min(5, Math.max(1, Math.round(input.rating)));

  if (input.kind === "APPLICANT" && input.applicantId) {
    const applicant = await prisma.applicant.findFirst({
      where: { id: input.applicantId, locationId: input.locationId },
    });
    if (!applicant) throw new Error("Applicant not found");

    return prisma.applicant.update({
      where: { id: input.applicantId },
      data: {
        ...(rating !== undefined ? { rating } : {}),
        ...(input.rehirable !== undefined ? { rehirable: input.rehirable } : {}),
        ...(input.talentNotes !== undefined
          ? { talentNotes: input.talentNotes?.trim() || null }
          : {}),
      },
    });
  }

  if (input.kind === "FORMER_EMPLOYEE" && input.staffMemberId) {
    const staff = await prisma.staffMember.findFirst({
      where: { id: input.staffMemberId, locationId: input.locationId, active: false },
    });
    if (!staff) throw new Error("Former employee not found");

    return prisma.staffMember.update({
      where: { id: input.staffMemberId },
      data: {
        ...(rating !== undefined ? { rating } : {}),
        ...(input.rehirable !== undefined ? { rehirable: input.rehirable } : {}),
        ...(input.talentNotes !== undefined
          ? { talentNotes: input.talentNotes?.trim() || null }
          : {}),
      },
    });
  }

  throw new Error("Invalid history record");
}
