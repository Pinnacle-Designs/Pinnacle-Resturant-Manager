import { prisma } from "@/lib/prisma";
import { getLocationId } from "@/lib/location";
import { PageHeader } from "@/components/ui";
import { OrdersClient } from "@/components/orders/OrdersClient";

export default async function OrdersPage() {
  const locationId = await getLocationId();
  const [orders, menuItems, tables] = await Promise.all([
    prisma.order.findMany({
      where: { locationId },
      include: { table: true, items: { include: { menuItem: true } }, payments: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.menuItem.findMany({ where: { locationId } }),
    prisma.table.findMany({ where: { locationId }, orderBy: { number: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Orders" description="Track active and completed orders" />
      <OrdersClient initialOrders={orders} menuItems={menuItems} tables={tables} />
    </div>
  );
}
