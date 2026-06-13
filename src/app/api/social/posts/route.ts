import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import type { SocialPostStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_social");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const posts = await prisma.socialPost.findMany({
    where: { locationId },
    include: {
      targets: {
        include: { account: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    posts.map((p) => ({
      ...p,
      scheduledFor: p.scheduledFor?.toISOString() ?? null,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      targets: p.targets.map((t) => ({
        ...t,
        publishedAt: t.publishedAt?.toISOString() ?? null,
      })),
    }))
  );
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_social");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const { content, mediaUrl, accountIds, scheduledFor, publishNow } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "Post content is required" }, { status: 400 });
  }
  if (!accountIds?.length) {
    return NextResponse.json({ error: "Select at least one platform" }, { status: 400 });
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: accountIds }, locationId, connected: true },
  });

  if (accounts.length === 0) {
    return NextResponse.json({ error: "No connected accounts found" }, { status: 400 });
  }

  let status: SocialPostStatus = "DRAFT";
  if (publishNow) status = "PUBLISHING";
  else if (scheduledFor) status = "SCHEDULED";

  const post = await prisma.socialPost.create({
    data: {
      locationId,
      content: content.trim(),
      mediaUrl: mediaUrl || null,
      status,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      targets: {
        create: accounts.map((a) => ({ accountId: a.id })),
      },
    },
    include: {
      targets: { include: { account: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: publishNow ? "PUBLISH" : scheduledFor ? "SCHEDULE" : "CREATE",
      entity: "socialPost",
      entityId: post.id,
      details: publishNow
        ? `Publishing post to ${accounts.length} platform(s)`
        : `Created social post (${status.toLowerCase()})`,
    },
  });

  const serialized = {
    ...post,
    scheduledFor: post.scheduledFor?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    targets: post.targets.map((t) => ({
      ...t,
      publishedAt: t.publishedAt?.toISOString() ?? null,
    })),
  };

  if (publishNow) {
    return NextResponse.json(serialized);
  }

  return NextResponse.json(serialized);
}
