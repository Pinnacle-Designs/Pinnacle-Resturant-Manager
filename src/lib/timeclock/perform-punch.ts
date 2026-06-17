import { prisma } from "@/lib/prisma";
import { startOfDay } from "date-fns";
import { verifyGeoClockIn } from "@/lib/timeclock/geo";
import { verifyPunchIdentity } from "@/lib/timeclock/verify-punch";
import { savePunchPhoto } from "@/lib/timeclock/save-punch-photo";
import { checkEarlyClockIn } from "@/lib/timeclock/early-clock-in";
import { verifyClockPin } from "@/lib/timeclock/clock-pin";
import { getStaffJobRoleOptions, resolvePunchWorkRole } from "@/lib/timeclock/staff-job-roles";
import { getOrCreateComplianceSettings, violationsToError } from "@/lib/compliance/validate-shift";
import {
  checkMinorClockIn,
  checkMinorWhileClockedIn,
  getMinorApproachingViolation,
} from "@/lib/compliance/minor-timeclock";
import { notifyManagerCompliance } from "@/lib/compliance/notify-manager";
import {
  BREAK_WAIVER_TEXT,
  needsBreakWaiver,
} from "@/lib/compliance/break-enforcement";
import { isTippedPunch, validateTipDeclaration } from "@/lib/compliance/tip-declaration";

type LocationRow = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  geoFenceRadiusM: number;
  geoClockInRequired: boolean;
  punchPhotoRequired: boolean;
  punchVerificationMode: string;
  earlyClockInBufferMins: number;
  blockUnscheduledPunch: boolean;
  mealBreakMinutes: number;
  restBreakMinutes: number;
  mealBreakRequiredAfterHours: number;
  mealBreakAlertMinutes: number;
};

export type PunchInput = {
  action: "in" | "out";
  staffMemberId: string;
  pin: string;
  latitude?: number | null;
  longitude?: number | null;
  photoDataUrl?: string | null;
  biometricVerified?: boolean;
  mealBreakTaken?: boolean;
  restBreakTaken?: boolean;
  breakWaiverAcknowledged?: boolean;
  declaredCashTips?: number | null;
  notes?: string | null;
  workRole?: string | null;
};

export async function performKioskPunch(locationId: string, input: PunchInput) {
  const staff = await prisma.staffMember.findFirst({
    where: { id: input.staffMemberId, locationId, active: true },
  });

  if (!staff) {
    return { ok: false as const, status: 404, error: "Staff member not found" };
  }

  if (!staff.clockPinHash) {
    return {
      ok: false as const,
      status: 400,
      error: "No clock PIN set. Ask your manager to set one on your profile.",
    };
  }

  if (!verifyClockPin(input.pin, staff.clockPinHash)) {
    return { ok: false as const, status: 401, error: "Incorrect PIN. Try again." };
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    return { ok: false as const, status: 404, error: "Location not found" };
  }

  const geo = verifyGeoClockIn(input.latitude, input.longitude, location);
  if (!geo.ok) {
    return { ok: false as const, status: 400, error: geo.error ?? "Location check failed" };
  }

  const compliance = await getOrCreateComplianceSettings(locationId);

  if (input.action === "in") {
    const minorViolations = checkMinorClockIn({
      dateOfBirth: staff.dateOfBirth,
      settings: compliance,
    });
    const blocked = minorViolations.filter((v) => v.severity === "block");
    if (blocked.length > 0) {
      return { ok: false as const, status: 400, error: violationsToError(blocked) };
    }

    const approaching = getMinorApproachingViolation({
      dateOfBirth: staff.dateOfBirth,
      clockInAt: null,
      settings: compliance,
    });
    if (approaching) {
      void notifyManagerCompliance({
        locationId,
        staffName: staff.name,
        alertCode: approaching.code,
        message: approaching.message,
      });
    }

    return clockIn(staff, location, input, geo.verified);
  }

  return clockOut(staff, location, compliance, input, geo.verified);
}

async function clockIn(
  staff: { id: string; userId: string | null; name: string },
  location: LocationRow,
  input: PunchInput,
  geoVerified: boolean
) {
  const existing = await prisma.timeEntry.findFirst({
    where: { staffMemberId: staff.id, clockOutAt: null },
  });
  if (existing) {
    return { ok: false as const, status: 400, error: `${staff.name} is already clocked in` };
  }

  const today = startOfDay(new Date());
  const match = await prisma.shift.findFirst({
    where: {
      locationId: location.id,
      staffMemberId: staff.id,
      date: { gte: today, lt: new Date(today.getTime() + 86400000) },
    },
    orderBy: { startTime: "asc" },
  });

  const early = checkEarlyClockIn(
    new Date(),
    match,
    location.earlyClockInBufferMins,
    location.blockUnscheduledPunch
  );
  if (!early.ok) {
    return { ok: false as const, status: 400, error: early.error };
  }

  const identity = verifyPunchIdentity(location, {
    photoDataUrl: input.photoDataUrl,
    biometricVerified: Boolean(input.biometricVerified),
  });
  if (!identity.ok) {
    return { ok: false as const, status: 400, error: identity.error };
  }

  const roleResult = await resolvePunchWorkRole(staff.id, input.workRole);
  if (!roleResult.ok) {
    return { ok: false as const, status: 400, error: roleResult.error };
  }

  let clockInPhotoUrl: string | null = null;
  if (identity.method === "PHOTO" && input.photoDataUrl) {
    try {
      clockInPhotoUrl = await savePunchPhoto(input.photoDataUrl);
    } catch (err) {
      return {
        ok: false as const,
        status: 400,
        error: err instanceof Error ? err.message : "Could not save punch photo",
      };
    }
  }

  const entry = await prisma.timeEntry.create({
    data: {
      locationId: location.id,
      staffMemberId: staff.id,
      userId: staff.userId,
      shiftId: match?.id ?? null,
      clockInAt: new Date(),
      clockInLat: input.latitude ?? null,
      clockInLng: input.longitude ?? null,
      geoVerifiedIn: geoVerified,
      clockInPhotoUrl,
      identityVerifiedIn: identity.verified,
      identityMethodIn: identity.method ?? null,
      workRole: roleResult.role,
      hourlyRateAtPunch: roleResult.hourlyRate,
    },
  });

  return {
    ok: true as const,
    action: "in" as const,
    staffName: staff.name,
    workRole: roleResult.role,
    hourlyRate: roleResult.hourlyRate,
    entry: {
      id: entry.id,
      clockInAt: entry.clockInAt.toISOString(),
    },
  };
}

async function clockOut(
  staff: {
    id: string;
    name: string;
    isTippedEmployee: boolean;
    dateOfBirth: Date | null;
  },
  location: LocationRow,
  compliance: Awaited<ReturnType<typeof getOrCreateComplianceSettings>>,
  input: PunchInput,
  geoVerified: boolean
) {
  const openEntry = await prisma.timeEntry.findFirst({
    where: { staffMemberId: staff.id, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
  if (!openEntry) {
    return { ok: false as const, status: 400, error: `${staff.name} is not clocked in` };
  }

  const minorViolations = checkMinorWhileClockedIn({
    dateOfBirth: staff.dateOfBirth,
    clockInAt: openEntry.clockInAt,
    settings: compliance,
  });
  const blockedMinor = minorViolations.filter((v) => v.severity === "block");
  if (blockedMinor.length > 0) {
    return { ok: false as const, status: 400, error: violationsToError(blockedMinor) };
  }

  if (input.mealBreakTaken === undefined || input.restBreakTaken === undefined) {
    return {
      ok: false as const,
      status: 400,
      error: "Break attestation required before clock out.",
    };
  }

  const mealTaken = Boolean(input.mealBreakTaken);
  const waiverRequired = needsBreakWaiver(mealTaken, openEntry.clockInAt, location);

  if (waiverRequired && !input.breakWaiverAcknowledged) {
    return {
      ok: false as const,
      status: 400,
      error: "Digital waiver required — you skipped your required meal break.",
      code: "BREAK_WAIVER_REQUIRED",
    };
  }

  const jobRoles = await getStaffJobRoleOptions(staff.id);
  const tipped = isTippedPunch({
    workRole: openEntry.workRole,
    isTippedEmployee: staff.isTippedEmployee,
    jobRoles,
  });
  const tipCheck = validateTipDeclaration(
    input.declaredCashTips,
    tipped && (compliance.requireTipDeclaration ?? true)
  );
  if (!tipCheck.ok) {
    return {
      ok: false as const,
      status: 400,
      error: tipCheck.error,
      code: "TIP_DECLARATION_REQUIRED",
    };
  }

  let clockOutPhotoUrl: string | null = null;
  let identityVerifiedOut = false;
  let identityMethodOut: string | null = null;

  if (location.punchPhotoRequired && (input.photoDataUrl || input.biometricVerified)) {
    const identity = verifyPunchIdentity(location, {
      photoDataUrl: input.photoDataUrl,
      biometricVerified: Boolean(input.biometricVerified),
    });
    if (identity.ok && identity.method === "PHOTO" && input.photoDataUrl) {
      try {
        clockOutPhotoUrl = await savePunchPhoto(input.photoDataUrl);
        identityVerifiedOut = true;
        identityMethodOut = "PHOTO";
      } catch {
        // optional on clock out
      }
    } else if (identity.ok && identity.method === "BIOMETRIC") {
      identityVerifiedOut = true;
      identityMethodOut = "BIOMETRIC";
    }
  }

  const entry = await prisma.timeEntry.update({
    where: { id: openEntry.id },
    data: {
      clockOutAt: new Date(),
      clockOutLat: input.latitude ?? null,
      clockOutLng: input.longitude ?? null,
      geoVerifiedOut: geoVerified,
      clockOutPhotoUrl,
      identityVerifiedOut,
      identityMethodOut,
      mealBreakTaken: mealTaken,
      restBreakTaken: Boolean(input.restBreakTaken),
      mealBreakWaived: waiverRequired && Boolean(input.breakWaiverAcknowledged),
      breakWaiverSignedAt: waiverRequired && input.breakWaiverAcknowledged ? new Date() : null,
      breakWaiverText: waiverRequired && input.breakWaiverAcknowledged ? BREAK_WAIVER_TEXT : null,
      declaredCashTips:
        input.declaredCashTips != null ? Number(input.declaredCashTips) : null,
      breakAttestedAt: new Date(),
      notes: input.notes?.trim() || null,
      approvalStatus: "PENDING",
    },
  });

  return {
    ok: true as const,
    action: "out" as const,
    staffName: staff.name,
    entry: {
      id: entry.id,
      clockInAt: entry.clockInAt.toISOString(),
      clockOutAt: entry.clockOutAt?.toISOString() ?? null,
      mealBreakWaived: entry.mealBreakWaived,
      declaredCashTips: entry.declaredCashTips,
    },
  };
}
