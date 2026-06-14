import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { deriveCheckStatus, getOrderBalanceDue, ORDER_INCLUDE } from "@/lib/orders";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requirePermission(request, "manage_orders");
  if (error) return error;

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { payments: true, table: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.checkStatus !== "CLOSED") {
    return NextResponse.json({ error: "Check is not closed" }, { status: 400 });
  }

  const balanceDue = getOrderBalanceDue(order, order.payments);
  const nextCheckStatus = deriveCheckStatus({
    checkStatus: "OPEN",
    balanceDue,
    payments: order.payments,
    printedAt: order.printedAt,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id },
      data: {
        checkStatus: nextCheckStatus,
        status: "SERVED",
        paidAt: null,
      },
      include: ORDER_INCLUDE,
    });

    if (order.tableId) {
      await tx.table.update({
        where: { id: order.tableId },
        data: { status: "occupied" },
      });
    }

    await tx.activityLog.create({
      data: {
        locationId: order.locationId,
        action: "UPDATE",
        entity: "order",
        entityId: order.id,
        details: `${user!.name} reopened check for edits`,
      },
    });

    return result;
  });

  return NextResponse.json({ order: updated });
}
