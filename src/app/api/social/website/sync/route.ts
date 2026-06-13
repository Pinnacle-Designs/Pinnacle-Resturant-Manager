import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import {
  connectionToMetrics,
  metricsToDbFields,
  syncWebsiteMetrics,
} from "@/lib/website-analytics";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_social");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const existing = await prisma.websiteConnection.findUnique({ where: { locationId } });

  if (!existing || !existing.connected) {
    return NextResponse.json({ error: "No website connected" }, { status: 404 });
  }

  const current = connectionToMetrics(existing);
  const synced = syncWebsiteMetrics(current);

  const website = await prisma.websiteConnection.update({
    where: { locationId },
    data: {
      connected: true,
      ...metricsToDbFields(synced),
    },
  });

  return NextResponse.json(website);
}
