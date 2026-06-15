import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_payroll");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  const run = await prisma.payrollRun.findFirst({
    where: { id, locationId },
    include: { payPeriod: true, lineItems: true },
  });

  if (!run) {
    return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
  }

  if (body.action === "finalize") {
    const updated = await prisma.$transaction(async (tx) => {
      const finalized = await tx.payrollRun.update({
        where: { id },
        data: { status: "FINALIZED", finalizedAt: new Date() },
        include: {
          lineItems: { include: { staffMember: { select: { id: true, name: true } } } },
          payPeriod: true,
        },
      });

      await tx.payPeriod.update({
        where: { id: run.payPeriodId },
        data: { status: "FINALIZED" },
      });

      await tx.ewaAdvance.updateMany({
        where: {
          locationId,
          status: { in: ["PENDING", "PAID"] },
          payPeriodId: null,
        },
        data: { status: "DEDUCTED", payPeriodId: run.payPeriodId },
      });

      return finalized;
    });

    await prisma.activityLog.create({
      data: {
        locationId,
        action: "UPDATE",
        entity: "payroll_run",
        entityId: id,
        details: "Payroll run finalized",
      },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
