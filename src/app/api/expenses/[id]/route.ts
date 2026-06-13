import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "view_finances");
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      description: body.description,
      amount: body.amount,
      category: body.category,
      date: body.date ? new Date(body.date) : undefined,
      receiptUrl: body.receiptUrl,
    },
  });

  return NextResponse.json(expense);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "view_finances");
  if (error) return error;

  const { id } = await params;
  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
