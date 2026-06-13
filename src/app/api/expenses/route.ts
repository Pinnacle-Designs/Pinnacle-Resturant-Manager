import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "view_finances");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const expenses = await prisma.expense.findMany({
    where: { locationId },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(expenses);
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "view_finances");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const expense = await prisma.expense.create({
    data: {
      locationId,
      description: body.description,
      amount: body.amount,
      category: body.category,
      date: body.date ? new Date(body.date) : new Date(),
      receiptUrl: body.receiptUrl,
    },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "CREATE",
      entity: "expense",
      entityId: expense.id,
      details: `Expense: ${expense.description} $${expense.amount}`,
    },
  });

  return NextResponse.json(expense);
}
