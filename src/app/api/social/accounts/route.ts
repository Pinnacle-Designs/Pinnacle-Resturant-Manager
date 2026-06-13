import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import type { SocialPlatform } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_social");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const accounts = await prisma.socialAccount.findMany({
    where: { locationId },
    orderBy: { platform: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_social");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const platform = body.platform as SocialPlatform;
  const accountName = String(body.accountName || "").trim();

  if (!platform || !accountName) {
    return NextResponse.json({ error: "Platform and account name required" }, { status: 400 });
  }

  const config = await import("@/lib/social").then((m) => m.getPlatformConfig(platform));
  const handle = accountName.replace(/^@/, "");

  const account = await prisma.socialAccount.upsert({
    where: { locationId_platform: { locationId, platform } },
    create: {
      locationId,
      platform,
      accountName: accountName.startsWith("@") ? accountName : `@${handle}`,
      profileUrl: `${config.profileBaseUrl}${handle}`,
      followers: body.followers ?? Math.floor(Math.random() * 5000) + 500,
      connected: true,
      lastSyncedAt: new Date(),
    },
    update: {
      accountName: accountName.startsWith("@") ? accountName : `@${handle}`,
      profileUrl: `${config.profileBaseUrl}${handle}`,
      connected: true,
      lastSyncedAt: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "CONNECT",
      entity: "socialAccount",
      entityId: account.id,
      details: `Connected ${platform} account ${account.accountName}`,
    },
  });

  return NextResponse.json(account);
}
