import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { buildLogBookSearchText, startOfBusinessDay } from "@/lib/log-book/utils";

const VALID_CATEGORIES = new Set([
  "GENERAL",
  "SALES",
  "STAFFING",
  "MAINTENANCE",
  "STAFF",
  "GUEST",
  "INVENTORY",
  "SAFETY",
  "OPERATIONS",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_log_book");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  const existing = await prisma.logBookEntry.findFirst({
    where: { id, locationId },
    include: { mentions: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  let mentions = existing.mentions.map((m) => ({
    staffMemberId: m.staffMemberId,
    mentionLabel: m.mentionLabel,
  }));

  if (Array.isArray(body.staffMemberIds)) {
    const members = await prisma.staffMember.findMany({
      where: { locationId, id: { in: body.staffMemberIds }, active: true },
      select: { id: true, name: true },
    });
    mentions = members.map((m) => ({ staffMemberId: m.id, mentionLabel: m.name }));
  }

  const content = body.content?.trim() ?? existing.content;
  const title = body.title !== undefined ? body.title?.trim() || null : existing.title;
  const category =
    body.category && VALID_CATEGORIES.has(body.category) ? body.category : existing.category;
  const authorName = existing.authorName;
  const staffingNote =
    body.staffingNote !== undefined ? body.staffingNote?.trim() || null : existing.staffingNote;
  const maintenanceNote =
    body.maintenanceNote !== undefined
      ? body.maintenanceNote?.trim() || null
      : existing.maintenanceNote;

  const searchText = buildLogBookSearchText({
    title,
    content,
    authorName,
    category,
    staffingNote,
    maintenanceNote,
    mentionLabels: mentions.map((m) => m.mentionLabel),
  });

  const entry = await prisma.$transaction(async (tx) => {
    await tx.logBookMention.deleteMany({ where: { entryId: id } });
    return tx.logBookEntry.update({
      where: { id },
      data: {
        logDate: body.logDate ? startOfBusinessDay(new Date(body.logDate)) : undefined,
        category,
        title,
        content,
        searchText,
        salesTotal: body.salesTotal ?? undefined,
        guestCount: body.guestCount ?? undefined,
        laborHours: body.laborHours ?? undefined,
        laborCost: body.laborCost ?? undefined,
        staffingNote,
        maintenanceNote,
        pinned: body.pinned !== undefined ? Boolean(body.pinned) : undefined,
        mentions: { create: mentions },
      },
      include: {
        mentions: {
          include: { staffMember: { select: { id: true, name: true, role: true } } },
        },
      },
    });
  });

  return NextResponse.json(entry);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_log_book");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);

  const existing = await prisma.logBookEntry.findFirst({ where: { id, locationId } });
  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  await prisma.logBookEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
