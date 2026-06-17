import { prisma } from "@/lib/prisma";

export type JobRoleOption = {
  role: string;
  hourlyRate: number;
  isTippedRole: boolean;
  tipPoints: number;
};

export async function getStaffJobRoleOptions(staffMemberId: string): Promise<JobRoleOption[]> {
  const staff = await prisma.staffMember.findUnique({
    where: { id: staffMemberId },
    include: { roleRates: { orderBy: { role: "asc" } } },
  });
  if (!staff) return [];

  if (staff.roleRates.length > 0) {
    return staff.roleRates.map((r) => ({
      role: r.role,
      hourlyRate: r.hourlyRate,
      isTippedRole: r.isTippedRole,
      tipPoints: r.tipPoints,
    }));
  }

  return [
    {
      role: staff.role,
      hourlyRate: staff.hourlyRate,
      isTippedRole: staff.isTippedEmployee,
      tipPoints: staff.tipPoints,
    },
  ];
}

export async function resolvePunchWorkRole(
  staffMemberId: string,
  workRole: string | null | undefined,
  options?: JobRoleOption[]
): Promise<
  | { ok: true; role: string; hourlyRate: number; isTippedRole: boolean }
  | { ok: false; error: string }
> {
  const roles = options ?? (await getStaffJobRoleOptions(staffMemberId));
  if (roles.length === 0) {
    return { ok: false, error: "No job roles configured for this employee." };
  }

  if (roles.length > 1 && !workRole?.trim()) {
    return {
      ok: false,
      error: `Select which role you are working today: ${roles.map((r) => r.role).join(", ")}.`,
    };
  }

  const roleName = workRole?.trim() || roles[0].role;
  const match = roles.find((r) => r.role === roleName);
  if (!match) {
    return {
      ok: false,
      error: `Invalid job role. Choose: ${roles.map((r) => r.role).join(", ")}.`,
    };
  }

  return {
    ok: true,
    role: match.role,
    hourlyRate: match.hourlyRate,
    isTippedRole: match.isTippedRole,
  };
}

export function formatJobRoleLabel(role: JobRoleOption): string {
  return `${role.role} ($${role.hourlyRate.toFixed(2)}/hr)`;
}
