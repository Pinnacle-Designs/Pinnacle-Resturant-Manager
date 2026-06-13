import { NextRequest, NextResponse } from "next/server";
import type { AppRole } from "@prisma/client";
import { getSessionUserFromRequest } from "./auth";
import { hasPermission, type Permission } from "./permissions";

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function requireAuth(request: NextRequest) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return { user: null, error: unauthorizedResponse() };
  return { user, error: null };
}

export async function requirePermission(request: NextRequest, permission: Permission) {
  const { user, error } = await requireAuth(request);
  if (error) return { user: null, error };
  if (!hasPermission(user!.role, permission)) {
    return { user: null, error: forbiddenResponse() };
  }
  return { user: user!, error: null };
}

export function stripSalaries<T extends { hourlyRate?: number }>(
  role: AppRole,
  items: T[]
): T[] {
  if (hasPermission(role, "view_salaries")) return items;
  return items.map((item) => {
    const { hourlyRate: _rate, ...rest } = item;
    void _rate;
    return rest as T;
  });
}
