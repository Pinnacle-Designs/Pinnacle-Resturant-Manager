import type { JobRoleOption } from "@/lib/timeclock/staff-job-roles";

export function isTippedPunch(params: {
  workRole: string | null | undefined;
  isTippedEmployee: boolean;
  jobRoles: JobRoleOption[];
}): boolean {
  if (params.workRole) {
    const match = params.jobRoles.find((r) => r.role === params.workRole);
    if (match) return match.isTippedRole;
  }
  return params.isTippedEmployee;
}

export function validateTipDeclaration(
  declaredCashTips: number | null | undefined,
  required: boolean
): { ok: true } | { ok: false; error: string } {
  if (!required) return { ok: true };
  if (declaredCashTips == null || Number.isNaN(declaredCashTips)) {
    return {
      ok: false,
      error: "Declared cash tips are required before clock out for tipped employees.",
    };
  }
  if (declaredCashTips < 0) {
    return { ok: false, error: "Declared cash tips cannot be negative." };
  }
  return { ok: true };
}
