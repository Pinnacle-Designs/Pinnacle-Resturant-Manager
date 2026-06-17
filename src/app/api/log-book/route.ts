import { NextRequest, NextResponse } from "next/server";
import type { LogBookCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission, requireAnyPermission } from "@/lib/api-auth";
import { buildLogBookSearchText, endOfBusinessDay, startOfBusinessDay } from "@/lib/log-book/utils";

const ENTRY_INCLUDE = {
  mentions: {
    include: {
      staffMember: { select: { id: true, name: true, role: true } },
    },
  },
} as const;

const VALID_CATEGORIES = new Set<string>([
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

async function resolveMentions(
  locationId: string,
  staffMemberIds: string[] | undefined
) {
  if (!staffMemberIds?.length) return [];
  const members = await prisma.staffMember.findMany({
    where: { locationId, id: { in: staffMemberIds }, active: true },
    select: { id: true, name: true },
  });
  return members.map((m) => ({
    staffMemberId: m.id,
    mentionLabel: m.name,
  }));
}

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "view_log_book");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const staffMemberId = searchParams.get("staffMemberId");
  const category = searchParams.get("category");
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(200, parseInt(searchParams.get("limit") || "100", 10));

  const where: Prisma.LogBookEntryWhereInput = { locationId };

  if (date) {
    const d = new Date(date);
    where.logDate = { gte: startOfBusinessDay(d), lte: endOfBusinessDay(d) };
  } else if (from || to) {
    where.logDate = {
      ...(from ? { gte: startOfBusinessDay(new Date(from)) } : {}),
      ...(to ? { lte: endOfBusinessDay(new Date(to)) } : {}),
    };
  }

  if (category && VALID_CATEGORIES.has(category)) {
    where.category = category as LogBookCategory;
  }

  if (staffMemberId) {
    where.mentions = { some: { staffMemberId } };
  }

  if (q) {
    where.OR = [
      { searchText: { contains: q } },
      { content: { contains: searchParams.get("q") || "" } },
      { title: { contains: searchParams.get("q") || "" } },
      { mentions: { some: { mentionLabel: { contains: searchParams.get("q") || "" } } } },
    ];
  }

  const [entries, dayDates] = await Promise.all([
    prisma.logBookEntry.findMany({
      where,
      include: ENTRY_INCLUDE,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
    prisma.logBookEntry.findMany({
      where: { locationId },
      select: { logDate: true },
      distinct: ["logDate"],
      orderBy: { logDate: "desc" },
      take: 60,
    }),
  ]);

  const canManage = !(await requirePermission(request, "manage_log_book")).error;

  return NextResponse.json({
    entries,
    recentDays: dayDates.map((d) => d.logDate.toISOString()),
    canManage,
    searchQuery: searchParams.get("q"),
  });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAnyPermission(request, [
    "manage_log_book",
    "manage_retention",
  ]);
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "Log entry content is required." }, { status: 400 });
  }

  const category = VALID_CATEGORIES.has(body.category) ? body.category : "GENERAL";
  const logDate = body.logDate ? startOfBusinessDay(new Date(body.logDate)) : startOfBusinessDay(new Date());
  const mentions = await resolveMentions(locationId, body.staffMemberIds);
  const mentionLabels = mentions.map((m) => m.mentionLabel);

  const searchText = buildLogBookSearchText({
    title: body.title,
    content: body.content.trim(),
    authorName: user!.name,
    category,
    staffingNote: body.staffingNote,
    maintenanceNote: body.maintenanceNote,
    mentionLabels,
  });

  const entry = await prisma.logBookEntry.create({
    data: {
      locationId,
      logDate,
      authorUserId: user!.id,
      authorName: user!.name,
      category,
      title: body.title?.trim() || null,
      content: body.content.trim(),
      searchText,
      salesTotal: body.salesTotal ?? null,
      guestCount: body.guestCount ?? null,
      laborHours: body.laborHours ?? null,
      laborCost: body.laborCost ?? null,
      staffingNote: body.staffingNote?.trim() || null,
      maintenanceNote: body.maintenanceNote?.trim() || null,
      pinned: Boolean(body.pinned),
      mentions: { create: mentions },
    },
    include: ENTRY_INCLUDE,
  });

  return NextResponse.json(entry);
}
