import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import { TIPPED_JOB_ROLES } from "@/lib/payroll/job-roles";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "view_salaries");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);

  const staff = await prisma.staffMember.findFirst({
    where: { id, locationId },
  });
  if (!staff) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  const rates = await prisma.staffRoleRate.findMany({
    where: { staffMemberId: id },
    orderBy: { role: "asc" },
  });

  return NextResponse.json(rates);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(request, "edit_staff");
  if (error) return error;

  const { id } = await params;
  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();

  const staff = await prisma.staffMember.findFirst({
    where: { id, locationId },
  });
  if (!staff) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  const rates = Array.isArray(body.rates) ? body.rates : [];
  if (rates.length === 0) {
    return NextResponse.json({ error: "At least one role rate is required" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.staffRoleRate.deleteMany({ where: { staffMemberId: id } });
    for (const rate of rates) {
      if (!rate.role || !Number.isFinite(Number(rate.hourlyRate))) continue;
      await tx.staffRoleRate.create({
        data: {
          staffMemberId: id,
          role: String(rate.role),
          hourlyRate: Number(rate.hourlyRate),
          tipPoints: Number(rate.tipPoints) || 1,
          isTippedRole:
            rate.isTippedRole ??
            TIPPED_JOB_ROLES.has(String(rate.role) as never),
        },
      });
    }
  });

  const updated = await prisma.staffRoleRate.findMany({
    where: { staffMemberId: id },
    orderBy: { role: "asc" },
  });

  return NextResponse.json(updated);
}
