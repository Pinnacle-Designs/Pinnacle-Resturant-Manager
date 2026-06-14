import { prisma } from "@/lib/prisma";
import { getLocationId } from "@/lib/location";
import { PageHeader } from "@/components/ui";
import { InventoryClient } from "@/components/inventory/InventoryClient";

export default async function InventoryPage() {
  const locationId = await getLocationId();
  const items = await prisma.inventoryItem.findMany({
    where: { locationId },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Scan barcodes to receive stock, connect a scale for weights, and track par levels"
      />
      <InventoryClient initialItems={items} />
    </div>
  );
}
