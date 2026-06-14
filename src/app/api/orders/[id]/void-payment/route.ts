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
  const body = await request.json();
  const paymentId = body.paymentId as string | undefined;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.checkStatus === "CLOSED") {
    return NextResponse.json(
      { error: "Reopen the check before voiding payments" },
      { status: 400 }
    );
  }

  const target =
    order.payments.find((p) => p.id === paymentId) ?? order.payments[0];
  if (!target) {
    return NextResponse.json({ error: "No payment to void" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderPayment.delete({ where: { id: target.id } });

    const fresh = await tx.order.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!fresh) throw new Error("Order missing");

    const balanceDue = getOrderBalanceDue(fresh, fresh.payments);
    const nextCheckStatus = deriveCheckStatus({
      checkStatus: "OPEN",
      balanceDue,
      payments: fresh.payments,
      printedAt: fresh.printedAt,
    });

    const result = await tx.order.update({
      where: { id },
      data: {
        checkStatus: nextCheckStatus,
        status: fresh.status === "PAID" ? "SERVED" : fresh.status,
        paidAt: null,
      },
      include: ORDER_INCLUDE,
    });

    await tx.activityLog.create({
      data: {
        locationId: order.locationId,
        action: "UPDATE",
        entity: "order",
        entityId: order.id,
        details: `${user!.name} voided ${target.method} payment of $${target.amount.toFixed(2)}`,
      },
    });

    return result;
  });

  return NextResponse.json({ order: updated });
}
