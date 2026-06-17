import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requireAuth } from "@/lib/api-auth";
import { performKioskPunch } from "@/lib/timeclock/perform-punch";
import { getOrCreateComplianceSettings } from "@/lib/compliance/validate-shift";
import { startOfDay } from "date-fns";

const locationSelect = {
  name: true,
  latitude: true,
  longitude: true,
  geoFenceRadiusM: true,
  geoClockInRequired: true,
  punchPhotoRequired: true,
  punchVerificationMode: true,
  earlyClockInBufferMins: true,
  blockUnscheduledPunch: true,
  mealBreakMinutes: true,
  restBreakMinutes: true,
  mealBreakRequiredAfterHours: true,
  mealBreakAlertMinutes: true,
} as const;

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request);
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const [location, complianceSettings] = await Promise.all([
    prisma.location.findUnique({
      where: { id: locationId },
      select: locationSelect,
    }),
    getOrCreateComplianceSettings(locationId),
  ]);

  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const staffMembers = await prisma.staffMember.findMany({
    where: { locationId, active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      hourlyRate: true,
      isTippedEmployee: true,
      tipPoints: true,
      imageUrl: true,
      clockPinHash: true,
      userId: true,
      roleRates: {
        orderBy: { role: "asc" },
        select: {
          role: true,
          hourlyRate: true,
          isTippedRole: true,
          tipPoints: true,
        },
      },
    },
  });

  const openEntries = await prisma.timeEntry.findMany({
    where: { locationId, clockOutAt: null },
    select: {
      staffMemberId: true,
      clockInAt: true,
      workRole: true,
      hourlyRateAtPunch: true,
    },
  });
  const openByStaff = new Map(openEntries.map((e) => [e.staffMemberId, e]));

  const today = startOfDay(new Date());
  const todayShifts = await prisma.shift.findMany({
    where: {
      locationId,
      date: { gte: today, lt: new Date(today.getTime() + 86400000) },
    },
    select: { staffMemberId: true, startTime: true, endTime: true, workRole: true },
  });
  const shiftsByStaff = new Map<
    string,
    { startTime: string; endTime: string; workRole: string | null }[]
  >();
  for (const s of todayShifts) {
    if (!s.staffMemberId) continue;
    const list = shiftsByStaff.get(s.staffMemberId) ?? [];
    list.push({
      startTime: s.startTime,
      endTime: s.endTime,
      workRole: s.workRole,
    });
    shiftsByStaff.set(s.staffMemberId, list);
  }

  return NextResponse.json({
    location,
    compliance: {
      requireTipDeclaration: complianceSettings.requireTipDeclaration ?? true,
    },
    staff: staffMembers.map((s) => {
      const open = openByStaff.get(s.id);
      const jobRoles =
        s.roleRates.length > 0
          ? s.roleRates.map((r) => ({
              role: r.role,
              hourlyRate: r.hourlyRate,
              isTippedRole: r.isTippedRole,
              tipPoints: r.tipPoints,
            }))
          : [
              {
                role: s.role,
                hourlyRate: s.hourlyRate,
                isTippedRole: s.isTippedEmployee,
                tipPoints: s.tipPoints,
              },
            ];

      return {
        id: s.id,
        name: s.name,
        role: s.role,
        isTippedEmployee: s.isTippedEmployee,
        imageUrl: s.imageUrl,
        hasPin: Boolean(s.clockPinHash),
        hasLinkedAccount: Boolean(s.userId),
        clockedIn: Boolean(open),
        clockInAt: open?.clockInAt.toISOString() ?? null,
        clockedInRole: open?.workRole ?? null,
        clockedInRate: open?.hourlyRateAtPunch ?? null,
        jobRoles,
        todayShifts: shiftsByStaff.get(s.id) ?? [],
      };
    }),
    serverTime: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request);
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  const action = body.action === "out" ? "out" : "in";
  if (!body.staffMemberId || !body.pin) {
    return NextResponse.json({ error: "Staff and PIN required" }, { status: 400 });
  }

  const result = await performKioskPunch(locationId, {
    action,
    staffMemberId: String(body.staffMemberId),
    pin: String(body.pin),
    workRole: body.workRole != null ? String(body.workRole) : null,
    latitude: body.latitude,
    longitude: body.longitude,
    photoDataUrl: body.photoDataUrl,
    biometricVerified: Boolean(body.biometricVerified),
    mealBreakTaken: body.mealBreakTaken,
    restBreakTaken: body.restBreakTaken,
    breakWaiverAcknowledged: Boolean(body.breakWaiverAcknowledged),
    declaredCashTips:
      body.declaredCashTips != null ? Number(body.declaredCashTips) : null,
    notes: body.notes,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
