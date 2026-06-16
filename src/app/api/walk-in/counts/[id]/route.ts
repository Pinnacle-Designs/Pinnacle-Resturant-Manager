import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { addCountLine, finalizeCountSession } from "@/lib/walk-in/count-session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_inventory");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  if (body.action === "finalize") {
    const session = await finalizeCountSession(id, locationId);
    return NextResponse.json({ session });
  }

  const result = await addCountLine(id, locationId, {
    inventoryItemId: body.inventoryItemId,
    countedQty: parseFloat(body.countedQty),
    countUnit: body.countUnit,
    weighedGrams: body.weighedGrams ? parseFloat(body.weighedGrams) : undefined,
    notes: body.notes,
    clientId: body.clientId,
  });

  return NextResponse.json(result);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_inventory");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);

  const session = await prisma.inventoryCountSession.findFirst({
    where: { id, locationId },
    include: {
      lines: { include: { inventoryItem: true } },
      zone: { include: { routeSteps: { include: { inventoryItem: true }, orderBy: { sortOrder: "asc" } } } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ session });
}
