import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";
import { requirePermission } from "@/lib/api-auth";
import { ORDER_INCLUDE } from "@/lib/orders";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_orders");
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const order = await prisma.order.update({
    where: { id },
    data: {
      status: body.status as OrderStatus | undefined,
      tableId: body.tableId,
      totalAmount: body.totalAmount,
      guestCount: body.guestCount,
      channel: body.channel,
      discountAmount: body.discountAmount,
      compAmount: body.compAmount,
      voidAmount: body.voidAmount,
      ticketTimeMinutes: body.ticketTimeMinutes,
      notes: body.notes,
    },
    include: ORDER_INCLUDE,
  });

  return NextResponse.json(order);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_orders");
  if (error) return error;

  const { id } = await params;
  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
