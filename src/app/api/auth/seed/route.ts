import { prisma } from "@/lib/prisma";
import { seedDemoUsers } from "@/lib/demo-users";
import { isAuthSeedRouteEnabled } from "@/lib/dev-routes";
import { privateJsonResponse } from "@/lib/secure-response";

export async function GET() {
  if (!isAuthSeedRouteEnabled()) {
    return privateJsonResponse({ error: "Not found" }, { status: 404 });
  }

  const count = await prisma.user.count();
  return privateJsonResponse({ count, ready: count >= 5 });
}

export async function POST() {
  if (!isAuthSeedRouteEnabled()) {
    return privateJsonResponse({ error: "Not found" }, { status: 404 });
  }

  const users = await seedDemoUsers();
  return privateJsonResponse({
    message: "Demo users ready",
    users: users.map(({ email, role }) => ({ email, role })),
  });
}
