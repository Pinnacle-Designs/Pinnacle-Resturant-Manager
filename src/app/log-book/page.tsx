import { prisma } from "@/lib/prisma";
import { getLocationId } from "@/lib/location";
import { PageHeader } from "@/components/ui";
import { LogBookClient } from "@/components/log-book/LogBookClient";

export default async function LogBookPage() {
  const locationId = await getLocationId();
  const staff = await prisma.staffMember.findMany({
    where: { locationId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });

  return (
    <div>
      <PageHeader
        title="Manager Log Book"
        description="Daily journal of sales, staffing, maintenance, and staff notes — searchable by employee or keyword"
      />
      <LogBookClient staff={staff} />
    </div>
  );
}
