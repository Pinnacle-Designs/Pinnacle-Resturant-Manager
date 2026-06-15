import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";

type RouteParams = { params: Promise<{ id: string }> };

async function applyApprovedSwap(
  swap: {
    kind: string;
    shiftId: string;
    requesterStaffId: string;
    counterpartyStaffId: string | null;
    offerShiftId: string | null;
  }
) {
  if (swap.kind === "BID") {
    await prisma.shift.update({
      where: { id: swap.shiftId },
      data: {
        staffMemberId: swap.requesterStaffId,
        isOpen: false,
      },
    });
    return;
  }

  if (swap.kind === "DROP") {
    await prisma.shift.update({
      where: { id: swap.shiftId },
      data: {
        staffMemberId: null,
        isOpen: true,
      },
    });
    return;
  }

  if (swap.kind === "SWAP" && swap.offerShiftId) {
    const shiftA = await prisma.shift.findUnique({ where: { id: swap.shiftId } });
    const shiftB = await prisma.shift.findUnique({ where: { id: swap.offerShiftId } });
    if (!shiftA || !shiftB) return;

    await prisma.$transaction([
      prisma.shift.update({
        where: { id: shiftA.id },
        data: { staffMemberId: shiftB.staffMemberId },
      }),
      prisma.shift.update({
        where: { id: shiftB.id },
        data: { staffMemberId: shiftA.staffMemberId },
      }),
    ]);
    return;
  }

  if (swap.counterpartyStaffId) {
    await prisma.shift.update({
      where: { id: swap.shiftId },
      data: { staffMemberId: swap.counterpartyStaffId },
    });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await requirePermission(request, "approve_shift_swaps");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const action = body.action as "approve" | "deny" | "cancel";

  const swap = await prisma.shiftSwapRequest.findFirst({
    where: { id, locationId },
  });
  if (!swap) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (swap.status !== "PENDING") {
    return NextResponse.json({ error: "Request already resolved" }, { status: 400 });
  }

  if (action === "approve") {
    await applyApprovedSwap(swap);
    const updated = await prisma.shiftSwapRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedByUserId: user!.id,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json({
      ...updated,
      reviewedAt: updated.reviewedAt?.toISOString(),
    });
  }

  if (action === "deny") {
    const updated = await prisma.shiftSwapRequest.update({
      where: { id },
      data: {
        status: "DENIED",
        reviewedByUserId: user!.id,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json({
      ...updated,
      reviewedAt: updated.reviewedAt?.toISOString(),
    });
  }

  if (action === "cancel") {
    const updated = await prisma.shiftSwapRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
