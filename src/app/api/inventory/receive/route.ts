import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { normalizeBarcode } from "@/lib/inventory-barcode";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_inventory");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const quantity = parseFloat(body.quantity);
  const itemId = body.itemId as string | undefined;
  const barcode = body.barcode ? normalizeBarcode(String(body.barcode)) : undefined;
  const createIfMissing = body.createIfMissing !== false;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be greater than zero" }, { status: 400 });
  }

  let item = itemId
    ? await prisma.inventoryItem.findFirst({ where: { id: itemId, locationId } })
    : null;

  if (!item && barcode) {
    item = await prisma.inventoryItem.findFirst({
      where: { locationId, barcode },
    });
  }

  if (!item && createIfMissing) {
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name required to create a new item" }, { status: 400 });
    }

    item = await prisma.inventoryItem.create({
      data: {
        locationId,
        name,
        barcode: barcode || null,
        quantity,
        unit: body.unit || "units",
        minQuantity: parseFloat(body.minQuantity) || 0,
        costPerUnit: parseFloat(body.costPerUnit) || 0,
        supplier: body.supplier || null,
        lastRestocked: new Date(),
      },
    });

    await prisma.activityLog.create({
      data: {
        locationId,
        action: "CREATE",
        entity: "inventory",
        entityId: item.id,
        details: `Received ${quantity} ${item.unit} via barcode scan — new item: ${item.name}`,
      },
    });

    return NextResponse.json({ item, created: true, added: quantity });
  }

  if (!item) {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }

  const updated = await prisma.inventoryItem.update({
    where: { id: item.id },
    data: {
      quantity: item.quantity + quantity,
      lastRestocked: new Date(),
      ...(barcode && !item.barcode ? { barcode } : {}),
      ...(body.unit && body.unit !== item.unit ? { unit: body.unit } : {}),
    },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "UPDATE",
      entity: "inventory",
      entityId: updated.id,
      details: `Received +${quantity} ${updated.unit} via scan (${updated.name}) — on hand ${updated.quantity}`,
    },
  });

  return NextResponse.json({ item: updated, created: false, added: quantity });
}
