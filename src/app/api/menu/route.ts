import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";

export async function GET(request: NextRequest) {
  const locationId = await getLocationIdFromRequest(request);
  const items = await prisma.menuItem.findMany({
    where: { locationId },
    orderBy: { category: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const item = await prisma.menuItem.create({
    data: {
      locationId,
      name: body.name,
      description: body.description,
      price: body.price,
      category: body.category,
      available: body.available ?? true,
      imageUrl: body.imageUrl,
    },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "CREATE",
      entity: "menuItem",
      entityId: item.id,
      details: `Added menu item: ${item.name}`,
    },
  });

  return NextResponse.json(item);
}
