import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requireAnyPermission } from "@/lib/api-auth";
import { resolveStaffMemberForUser } from "@/lib/staff-resolve";
import { verifyGeoClockIn } from "@/lib/timeclock/geo";
import { startOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  const { user, error } = await requireAnyPermission(request, ["clock_in", "manage_schedule"]);
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const staff = await resolveStaffMemberForUser(user!, locationId);
  if (!staff) {
    return NextResponse.json(
      { error: "No staff profile linked to your account. Ask your manager to add you to the roster." },
      { status: 404 }
    );
  }

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: {
      name: true,
      latitude: true,
      longitude: true,
      geoFenceRadiusM: true,
      geoClockInRequired: true,
      mealBreakMinutes: true,
      restBreakMinutes: true,
    },
  });

  const openEntry = await prisma.timeEntry.findFirst({
    where: { staffMemberId: staff.id, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
    include: { shift: true },
  });

  const today = startOfDay(new Date());
  const todayShifts = await prisma.shift.findMany({
    where: {
      locationId,
      staffMemberId: staff.id,
      date: { gte: today, lt: new Date(today.getTime() + 86400000) },
    },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json({
    staff: { id: staff.id, name: staff.name, role: staff.role },
    location,
    clockedIn: !!openEntry,
    activeEntry: openEntry
      ? {
          ...openEntry,
          clockInAt: openEntry.clockInAt.toISOString(),
          clockOutAt: openEntry.clockOutAt?.toISOString() ?? null,
        }
      : null,
    todayShifts: todayShifts.map((s) => ({ ...s, date: s.date.toISOString() })),
  });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAnyPermission(request, ["clock_in"]);
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const staff = await resolveStaffMemberForUser(user!, locationId);
  if (!staff) {
    return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
  }

  const existing = await prisma.timeEntry.findFirst({
    where: { staffMemberId: staff.id, clockOutAt: null },
  });
  if (existing) {
    return NextResponse.json({ error: "Already clocked in" }, { status: 400 });
  }

  const body = await request.json();
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const geo = verifyGeoClockIn(body.latitude, body.longitude, location);
  if (!geo.ok) {
    return NextResponse.json({ error: geo.error }, { status: 400 });
  }

  let shiftId: string | null = body.shiftId ?? null;
  if (!shiftId) {
    const today = startOfDay(new Date());
    const match = await prisma.shift.findFirst({
      where: {
        locationId,
        staffMemberId: staff.id,
        date: { gte: today, lt: new Date(today.getTime() + 86400000) },
      },
      orderBy: { startTime: "asc" },
    });
    shiftId = match?.id ?? null;
  }

  const entry = await prisma.timeEntry.create({
    data: {
      locationId,
      staffMemberId: staff.id,
      userId: user!.id,
      shiftId,
      clockInAt: new Date(),
      clockInLat: body.latitude ?? null,
      clockInLng: body.longitude ?? null,
      geoVerifiedIn: geo.verified,
    },
  });

  return NextResponse.json({
    entry: {
      ...entry,
      clockInAt: entry.clockInAt.toISOString(),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireAnyPermission(request, ["clock_in"]);
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const staff = await resolveStaffMemberForUser(user!, locationId);
  if (!staff) {
    return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
  }

  const body = await request.json();
  const openEntry = await prisma.timeEntry.findFirst({
    where: { staffMemberId: staff.id, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
  if (!openEntry) {
    return NextResponse.json({ error: "Not clocked in" }, { status: 400 });
  }

  if (body.mealBreakTaken === undefined || body.restBreakTaken === undefined) {
    return NextResponse.json(
      { error: "Break attestation required: confirm meal and rest breaks received." },
      { status: 400 }
    );
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const geo = verifyGeoClockIn(body.latitude, body.longitude, location);

  const entry = await prisma.timeEntry.update({
    where: { id: openEntry.id },
    data: {
      clockOutAt: new Date(),
      clockOutLat: body.latitude ?? null,
      clockOutLng: body.longitude ?? null,
      geoVerifiedOut: geo.verified,
      mealBreakTaken: Boolean(body.mealBreakTaken),
      restBreakTaken: Boolean(body.restBreakTaken),
      breakAttestedAt: new Date(),
      notes: body.notes?.trim() || null,
    },
  });

  return NextResponse.json({
    entry: {
      ...entry,
      clockInAt: entry.clockInAt.toISOString(),
      clockOutAt: entry.clockOutAt?.toISOString() ?? null,
      breakAttestedAt: entry.breakAttestedAt?.toISOString() ?? null,
    },
  });
}
