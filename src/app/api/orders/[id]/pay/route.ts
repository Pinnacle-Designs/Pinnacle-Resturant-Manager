import { NextRequest, NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/api-auth";
import {
  getOrderBalanceDue,
  getPaymentsTotal,
  roundMoney,
} from "@/lib/orders";

const ORDER_INCLUDE = {
  table: true,
  items: { include: { menuItem: true } },
  payments: { orderBy: { createdAt: "asc" as const } },
};

const VALID_METHODS = new Set<PaymentMethod>([
  "CASH",
  "CARD",
  "DEBIT",
  "MOBILE",
  "GIFT_CARD",
  "OTHER",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAnyPermission(request, [
    "manage_orders",
    "place_orders",
  ]);
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const method = body.method as PaymentMethod;
  if (!method || !VALID_METHODS.has(method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }

  const amount = roundMoney(Number(body.amount));
  const tipAmount = roundMoney(Number(body.tipAmount) || 0);
  const cashTendered =
    body.cashTendered != null ? roundMoney(Number(body.cashTendered)) : null;
  const reference =
    typeof body.reference === "string" && body.reference.trim()
      ? body.reference.trim().slice(0, 64)
      : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
  }
  if (!Number.isFinite(tipAmount) || tipAmount < 0) {
    return NextResponse.json({ error: "Invalid tip amount" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { payments: true, table: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "PAID") {
    return NextResponse.json({ error: "Order is already paid" }, { status: 400 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot pay a cancelled order" }, { status: 400 });
  }

  const balanceDue = getOrderBalanceDue(order, order.payments);
  if (amount > balanceDue + 0.001) {
    return NextResponse.json(
      { error: `Payment exceeds balance due (${balanceDue.toFixed(2)})` },
      { status: 400 }
    );
  }

  if (method === "CASH" && cashTendered != null && cashTendered < amount + tipAmount) {
    return NextResponse.json(
      { error: "Cash tendered is less than payment plus tip" },
      { status: 400 }
    );
  }

  const totalAfterPayment = getPaymentsTotal(order.payments) + amount;
  const fullyPaid = totalAfterPayment >= getOrderBalanceDue(order, []) - 0.001;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderPayment.create({
      data: {
        orderId: id,
        method,
        amount,
        tipAmount,
        reference,
      },
    });

    const nextStatus = fullyPaid
      ? "PAID"
      : order.status === "PENDING" || order.status === "PREPARING"
        ? "SERVED"
        : order.status;

    const result = await tx.order.update({
      where: { id },
      data: {
        status: nextStatus,
        paidAt: fullyPaid ? new Date() : null,
      },
      include: ORDER_INCLUDE,
    });

    if (fullyPaid && order.tableId) {
      await tx.table.update({
        where: { id: order.tableId },
        data: { status: "available" },
      });
    }

    await tx.activityLog.create({
      data: {
        locationId: order.locationId,
        action: "UPDATE",
        entity: "order",
        entityId: order.id,
        details: `${user!.name} recorded ${method} payment of $${amount.toFixed(2)}${
          tipAmount > 0 ? ` (+$${tipAmount.toFixed(2)} tip)` : ""
        }`,
      },
    });

    return result;
  });

  const newBalance = getOrderBalanceDue(updated, updated.payments);
  const changeDue =
    method === "CASH" && cashTendered != null
      ? roundMoney(Math.max(0, cashTendered - amount - tipAmount))
      : null;

  return NextResponse.json({
    order: updated,
    changeDue,
    balanceDue: newBalance,
    fullyPaid: updated.status === "PAID",
  });
}
