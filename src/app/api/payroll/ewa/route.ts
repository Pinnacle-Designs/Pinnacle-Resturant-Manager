import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requireAnyPermission } from "@/lib/api-auth";
import { userCan } from "@/lib/permission-resolve";
import {
  loadPayrollPreview,
  getOrCreatePayrollSettings,
} from "@/lib/payroll/load-context";
import { settingsFromDb, computeEwaAvailability, getDefaultPayPeriod } from "@/lib/payroll/compute";

async function resolveStaffMember(locationId: string, userId: string, staffMemberId?: string) {
  if (staffMemberId) {
    return prisma.staffMember.findFirst({
      where: { id: staffMemberId, locationId },
    });
  }
  return prisma.staffMember.findFirst({
    where: { locationId, userId },
  });
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireAnyPermission(request, [
    "manage_payroll",
    "request_ewa",
  ]);
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const staffMemberId = request.nextUrl.searchParams.get("staffMemberId") ?? undefined;

  const canManage = await userCan(user!, "manage_payroll");
  const canRequest = await userCan(user!, "request_ewa");

  if (!canManage && !canRequest) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settingsRow = await getOrCreatePayrollSettings(locationId);
  const settings = settingsFromDb(settingsRow);

  if (!settings.ewaEnabled) {
    return NextResponse.json({ enabled: false, advances: [] });
  }

  const member = await resolveStaffMember(
    locationId,
    user!.id,
    canManage ? staffMemberId : undefined
  );

  if (!member) {
    return NextResponse.json({ error: "Staff profile not linked" }, { status: 404 });
  }

  const { start, end } = getDefaultPayPeriod(new Date(), settings.payPeriodDays);
  const preview = await loadPayrollPreview(locationId, start, end);

  const pending = await prisma.ewaAdvance.aggregate({
    where: {
      staffMemberId: member.id,
      status: { in: ["PENDING", "PAID"] },
    },
    _sum: { amount: true, fee: true },
  });

  const deducted = await prisma.ewaAdvance.aggregate({
    where: { staffMemberId: member.id, status: "DEDUCTED" },
    _sum: { amount: true },
  });

  const availability = computeEwaAvailability(
    member.id,
    preview,
    settings,
    (pending._sum.amount ?? 0) + (pending._sum.fee ?? 0),
    deducted._sum.amount ?? 0
  );

  const advances = canManage
    ? await prisma.ewaAdvance.findMany({
        where: { locationId },
        orderBy: { requestedAt: "desc" },
        take: 50,
        include: { staffMember: { select: { id: true, name: true } } },
      })
    : await prisma.ewaAdvance.findMany({
        where: { staffMemberId: member.id },
        orderBy: { requestedAt: "desc" },
        take: 20,
      });

  return NextResponse.json({ enabled: true, availability, advances });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAnyPermission(request, [
    "manage_payroll",
    "request_ewa",
  ]);
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const amount = Number(body.amount);

  const canManage = await userCan(user!, "manage_payroll");
  const canRequest = await userCan(user!, "request_ewa");

  if (!canManage && !canRequest) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settingsRow = await getOrCreatePayrollSettings(locationId);
  const settings = settingsFromDb(settingsRow);

  if (!settings.ewaEnabled) {
    return NextResponse.json({ error: "Earned wage access is not enabled" }, { status: 400 });
  }

  const member = await resolveStaffMember(
    locationId,
    user!.id,
    canManage ? body.staffMemberId : undefined
  );

  if (!member) {
    return NextResponse.json({ error: "Staff profile not linked to your account" }, { status: 404 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const { start, end } = getDefaultPayPeriod(new Date(), settings.payPeriodDays);
  const preview = await loadPayrollPreview(locationId, start, end);

  const pending = await prisma.ewaAdvance.aggregate({
    where: {
      staffMemberId: member.id,
      status: { in: ["PENDING", "PAID"] },
    },
    _sum: { amount: true, fee: true },
  });

  const availability = computeEwaAvailability(
    member.id,
    preview,
    settings,
    (pending._sum.amount ?? 0) + (pending._sum.fee ?? 0),
    0
  );

  if (amount > availability.availableAmount) {
    return NextResponse.json(
      {
        error: `Maximum available advance is $${availability.availableAmount.toFixed(2)}`,
        availability,
      },
      { status: 400 }
    );
  }

  const advance = await prisma.ewaAdvance.create({
    data: {
      locationId,
      staffMemberId: member.id,
      amount,
      fee: settings.ewaFeeFlat,
      status: canManage ? "PAID" : "PENDING",
      earnedAtRequest: availability.earnedToDate,
      paidAt: canManage ? new Date() : null,
    },
    include: { staffMember: { select: { id: true, name: true } } },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "CREATE",
      entity: "ewa_advance",
      entityId: advance.id,
      details: `EWA advance $${amount.toFixed(2)} for ${member.name}`,
    },
  });

  return NextResponse.json(advance);
}
