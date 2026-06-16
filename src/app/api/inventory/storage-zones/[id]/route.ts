import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { uniqueZoneSlug } from "@/lib/walk-in/storage-zones";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_inventory");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  const existing = await prisma.storageZone.findFirst({ where: { id, locationId } });
  if (!existing) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const slug =
    name !== existing.name ? await uniqueZoneSlug(locationId, name) : existing.slug;

  const zone = await prisma.storageZone.update({
    where: { id },
    data: {
      name,
      slug,
      sortOrder: body.sortOrder ?? existing.sortOrder,
    },
    include: { _count: { select: { items: true, routeSteps: true } } },
  });

  return NextResponse.json(zone);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "manage_inventory");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);

  const existing = await prisma.storageZone.findFirst({
    where: { id, locationId },
    include: { _count: { select: { items: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  await prisma.storageZone.delete({ where: { id } });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "DELETE",
      entity: "storage_zone",
      entityId: id,
      details: `Deleted storage zone: ${existing.name}`,
    },
  });

  return NextResponse.json({ success: true });
}
