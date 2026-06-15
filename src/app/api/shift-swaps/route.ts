import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requireAnyPermission } from "@/lib/api-auth";
import { resolveStaffMemberForUser } from "@/lib/staff-resolve";
import { userCan } from "@/lib/permission-resolve";

export async function GET(request: NextRequest) {
  const { user, error } = await requireAnyPermission(request, [
    "view_own_schedule",
    "manage_schedule",
    "approve_shift_swaps",
  ]);
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const status = request.nextUrl.searchParams.get("status");

  const where: {
    locationId: string;
    status?: "PENDING" | "APPROVED" | "DENIED" | "CANCELLED";
    OR?: Array<{ requesterStaffId: string } | { counterpartyStaffId: string }>;
  } = { locationId };

  if (status) where.status = status as typeof where.status;

  const canManage =
    (await userCan(user!, "approve_shift_swaps")) ||
    (await userCan(user!, "manage_schedule"));

  if (!canManage) {
    const staff = await resolveStaffMemberForUser(user!, locationId);
    if (!staff) {
      return NextResponse.json({ requests: [] });
    }
    where.OR = [{ requesterStaffId: staff.id }, { counterpartyStaffId: staff.id }];
  }

  const requests = await prisma.shiftSwapRequest.findMany({
    where,
    include: {
      shift: { include: { staffMember: true } },
      requesterStaff: true,
      counterpartyStaff: true,
      offerShift: { include: { staffMember: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      shift: { ...r.shift, date: r.shift.date.toISOString() },
      offerShift: r.offerShift
        ? { ...r.offerShift, date: r.offerShift.date.toISOString() }
        : null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAnyPermission(request, ["view_own_schedule", "clock_in"]);
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const staff = await resolveStaffMemberForUser(user!, locationId);
  if (!staff) {
    return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
  }

  const body = await request.json();
  const kind = body.kind as "SWAP" | "BID" | "DROP";
  if (!kind || !["SWAP", "BID", "DROP"].includes(kind)) {
    return NextResponse.json({ error: "Invalid request kind" }, { status: 400 });
  }

  const shift = await prisma.shift.findFirst({
    where: { id: body.shiftId, locationId },
  });
  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  if (kind === "BID") {
    if (!shift.isOpen) {
      return NextResponse.json({ error: "Shift is not open for bidding" }, { status: 400 });
    }
  } else if (shift.staffMemberId !== staff.id) {
    return NextResponse.json({ error: "You can only request swaps for your own shifts" }, { status: 403 });
  }

  if (kind === "SWAP" && body.offerShiftId) {
    const offer = await prisma.shift.findFirst({
      where: { id: body.offerShiftId, locationId, staffMemberId: staff.id },
    });
    if (!offer) {
      return NextResponse.json({ error: "Offer shift not found" }, { status: 404 });
    }
  }

  const swap = await prisma.shiftSwapRequest.create({
    data: {
      locationId,
      kind,
      shiftId: shift.id,
      requesterStaffId: staff.id,
      counterpartyStaffId: body.counterpartyStaffId || null,
      offerShiftId: body.offerShiftId || null,
      message: body.message?.trim() || null,
    },
    include: {
      shift: { include: { staffMember: true } },
      requesterStaff: true,
    },
  });

  return NextResponse.json({
    ...swap,
    createdAt: swap.createdAt.toISOString(),
    shift: { ...swap.shift, date: swap.shift.date.toISOString() },
  });
}
