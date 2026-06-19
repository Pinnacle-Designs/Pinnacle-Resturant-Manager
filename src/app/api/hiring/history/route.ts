import { NextRequest, NextResponse } from "next/server";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import {
  fetchHiringHistory,
  updateHiringHistoryTalent,
  type HistorySort,
  type HiringHistoryKind,
} from "@/lib/hiring/history";
import type { RehireStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_hiring");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const sort = (request.nextUrl.searchParams.get("sort") as HistorySort) || "rating";

  const records = await fetchHiringHistory(locationId, sort);
  return NextResponse.json({ records, sort });
}

export async function PATCH(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_hiring");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  const kind = body.kind as HiringHistoryKind;
  if (kind !== "APPLICANT" && kind !== "FORMER_EMPLOYEE") {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  try {
    await updateHiringHistoryTalent({
      kind,
      applicantId: body.applicantId ?? null,
      staffMemberId: body.staffMemberId ?? null,
      locationId,
      rating: body.rating,
      rehirable: body.rehirable as RehireStatus | undefined,
      talentNotes: body.talentNotes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 404 }
    );
  }

  const records = await fetchHiringHistory(locationId, "rating");
  const updated = records.find(
    (r) =>
      (kind === "APPLICANT" && r.applicantId === body.applicantId) ||
      (kind === "FORMER_EMPLOYEE" && r.staffMemberId === body.staffMemberId)
  );

  return NextResponse.json({ ok: true, record: updated ?? null });
}
