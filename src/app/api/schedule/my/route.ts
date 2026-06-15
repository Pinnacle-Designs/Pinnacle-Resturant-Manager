import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requireAnyPermission } from "@/lib/api-auth";
import { getWeekStart, getWeekEnd } from "@/lib/schedule";
import { resolveStaffMemberForUser } from "@/lib/staff-resolve";

export async function GET(request: NextRequest) {
  const { user, error } = await requireAnyPermission(request, [
    "view_own_schedule",
    "manage_schedule",
  ]);
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const weekParam = request.nextUrl.searchParams.get("weekStart");
  const weekStart = weekParam ? new Date(weekParam) : getWeekStart();
  const weekEnd = getWeekEnd(weekStart);

  let staffMemberId: string | undefined;
  if (!user!.permissions?.includes("manage_schedule") && user!.role !== "OWNER" && user!.role !== "MANAGER") {
    const staff = await resolveStaffMemberForUser(user!, locationId);
    if (!staff) {
      return NextResponse.json({ shifts: [], openShifts: [] });
    }
    staffMemberId = staff.id;
  }

  const [myShifts, openShifts] = await Promise.all([
    prisma.shift.findMany({
      where: {
        locationId,
        date: { gte: weekStart, lte: weekEnd },
        ...(staffMemberId ? { staffMemberId } : {}),
      },
      include: { staffMember: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.shift.findMany({
      where: {
        locationId,
        date: { gte: weekStart, lte: weekEnd },
        isOpen: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  return NextResponse.json({
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    shifts: myShifts.map((s) => ({ ...s, date: s.date.toISOString() })),
    openShifts: openShifts.map((s) => ({ ...s, date: s.date.toISOString() })),
  });
}
