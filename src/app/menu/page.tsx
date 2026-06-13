import { prisma } from "@/lib/prisma";
import { getLocationId } from "@/lib/location";
import { PageHeader } from "@/components/ui";
import { MenuClient } from "@/components/menu/MenuClient";

export default async function MenuPage() {
  const locationId = await getLocationId();
  const items = await prisma.menuItem.findMany({
    where: { locationId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader title="Menu" description="Manage menu items, pricing, and availability" />
      <MenuClient initialItems={items} />
    </div>
  );
}
