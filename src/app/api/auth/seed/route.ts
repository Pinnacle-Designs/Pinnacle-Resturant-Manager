import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDemoUsers } from "@/lib/demo-users";

export async function GET() {
  const count = await prisma.user.count();
  return NextResponse.json({ count, ready: count >= 5 });
}

export async function POST() {
  const users = await seedDemoUsers();
  return NextResponse.json({
    message: "Demo users ready",
    users,
  });
}
