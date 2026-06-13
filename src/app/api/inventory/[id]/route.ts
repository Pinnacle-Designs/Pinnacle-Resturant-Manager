import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: body.name,
      quantity: body.quantity,
      unit: body.unit,
      minQuantity: body.minQuantity,
      costPerUnit: body.costPerUnit,
      supplier: body.supplier,
      imageUrl: body.imageUrl,
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.inventoryItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
