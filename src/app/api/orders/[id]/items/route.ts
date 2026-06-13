import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "add_to_check");
  if (error) return error;

  const { id: orderId } = await params;
  const body = await request.json();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "PAID" || order.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot modify a closed order" }, { status: 400 });
  }

  await prisma.orderItem.create({
    data: {
      orderId,
      menuItemId: body.menuItemId,
      quantity: body.quantity || 1,
      price: body.price,
    },
  });

  const lineTotal = (body.quantity || 1) * body.price;
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { totalAmount: order.totalAmount + lineTotal },
    include: { items: { include: { menuItem: true } }, table: true },
  });

  return NextResponse.json(updated);
}
