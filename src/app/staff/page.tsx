import { prisma } from "@/lib/prisma";
import { getLocationId } from "@/lib/location";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { stripSalaries } from "@/lib/api-auth";
import { PageHeader } from "@/components/ui";
import { StaffPageClient } from "@/components/staff/StaffPageClient";

export default async function StaffPage() {
  const locationId = await getLocationId();
  const user = await getSessionUser();
  const staff = await prisma.staffMember.findMany({
    where: { locationId },
    orderBy: { name: "asc" },
  });

  const safeStaff = user ? stripSalaries(user.role, staff) : staff;

  return (
    <div>
      <PageHeader
        title="Staff"
        description={
          user && hasPermission(user.role, "edit_staff")
            ? "Manage your team and build weekly schedules"
            : "View your team roster"
        }
      />
      <StaffPageClient initialStaff={safeStaff} />
    </div>
  );
}
