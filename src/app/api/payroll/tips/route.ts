import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { loadPayrollPreview, getOrCreatePayrollSettings } from "@/lib/payroll/load-context";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_payroll");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const periodStart = new Date(body.periodStart);
  const periodEnd = new Date(body.periodEnd);

  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return NextResponse.json({ error: "Invalid period dates" }, { status: 400 });
  }

  const preview = await loadPayrollPreview(locationId, periodStart, periodEnd);
  const settingsRow = await getOrCreatePayrollSettings(locationId);

  const run = await prisma.tipPoolRun.create({
    data: {
      locationId,
      periodStart,
      periodEnd,
      totalTips: preview.totalTips,
      mode: settingsRow.tipPoolMode,
      status: "finalized",
      allocations: {
        create: preview.tipAllocations
          .filter((a) => a.tipsAmount > 0 || a.tipCreditMakeup > 0)
          .map((a) => ({
            staffMemberId: a.staffMemberId,
            hoursWorked: a.hoursWorked,
            tipPoints: a.tipPoints,
            sharePercent: a.sharePercent,
            tipsAmount: a.tipsAmount,
            tipCreditMakeup: a.tipCreditMakeup,
          })),
      },
    },
    include: { allocations: { include: { staffMember: true } } },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "CREATE",
      entity: "tip_pool",
      entityId: run.id,
      details: `Tip pool run: $${preview.totalTips.toFixed(2)} allocated`,
    },
  });

  return NextResponse.json(run);
}

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_payroll");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const runs = await prisma.tipPoolRun.findMany({
    where: { locationId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      allocations: { include: { staffMember: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json(runs);
}
