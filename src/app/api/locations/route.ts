import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationId } from "@/lib/location";

export async function GET() {
  const currentId = await getLocationId();
  const locations = await prisma.location.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ locations, currentId });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const location = await prisma.location.create({
    data: {
      name: body.name,
      address: body.address || null,
      phone: body.phone || null,
    },
  });
  return NextResponse.json(location);
}
