import { prisma } from "@/lib/prisma";
import { getLocationId } from "@/lib/location";
import { PageHeader } from "@/components/ui";
import { TablesClient } from "@/components/tables/TablesClient";

export default async function TablesPage() {
  const locationId = await getLocationId();
  const tables = await prisma.table.findMany({
    where: { locationId },
    orderBy: { number: "asc" },
    include: {
      orders: {
        where: { status: { notIn: ["PAID", "CANCELLED"] } },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Tables"
        description="Manage your dining floor — availability, capacity, and status"
      />
      <TablesClient initialTables={tables} />
    </div>
  );
}
