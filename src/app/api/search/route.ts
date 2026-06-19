import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getLocationIdFromRequest } from "@/lib/location";
import { resolveEffectivePermissions } from "@/lib/permission-resolve";
import {
  canSearchType,
  searchNavItems,
  searchRecords,
} from "@/lib/search/global-search";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error || !user) return error!;

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);

    const permissions =
      user.permissions?.length
        ? user.permissions
        : await resolveEffectivePermissions(user.role, user.locationId, user.id);

    if (!q) {
      const nav = searchNavItems("", user.role, user.plan, permissions);
      return NextResponse.json({ results: nav.slice(0, limit), query: q });
    }

    const locationId = await getLocationIdFromRequest(request);
    const [nav, records] = await Promise.all([
      Promise.resolve(searchNavItems(q, user.role, user.plan, permissions)),
      searchRecords(locationId, q, limit),
    ]);

    const combined = [...nav, ...records].filter((r) => canSearchType(r.type, permissions));

    return NextResponse.json({ results: combined.slice(0, limit), query: q });
  } catch (err) {
    console.error("[search GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed", results: [] },
      { status: 500 }
    );
  }
}
