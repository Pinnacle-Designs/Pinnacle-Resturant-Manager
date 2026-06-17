import { prisma } from "@/lib/prisma";
import { getLocationId } from "@/lib/location";
import { PageHeader } from "@/components/ui";
import { TablesClient } from "@/components/tables/TablesClient";
import {
  ensureFloorPlanDefaults,
  fillMissingPositions,
  parseFloorPlanSections,
} from "@/lib/tables/floor-plan";
import { fitFloorPlanToTables, toTableBounds } from "@/lib/tables/floor-plan-layout";

export default async function TablesPage() {
  const locationId = await getLocationId();
  await ensureFloorPlanDefaults(locationId);

  const location = await prisma.location.findUniqueOrThrow({
    where: { id: locationId },
    select: {
      floorPlanWidth: true,
      floorPlanHeight: true,
      floorPlanSections: true,
    },
  });

  const rawTables = await prisma.table.findMany({
    where: { locationId },
    orderBy: { number: "asc" },
    include: {
      orders: {
        where: { status: { notIn: ["PAID", "CANCELLED"] } },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      reservations: {
        where: {
          status: { in: ["CONFIRMED", "SEATED"] },
          reservationAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        },
        orderBy: { reservationAt: "asc" },
        take: 1,
      },
    },
  });

  const positioned = fillMissingPositions(
    rawTables,
    location.floorPlanWidth,
    location.floorPlanHeight
  );

  const sections = parseFloorPlanSections(location.floorPlanSections);
  const fitted = fitFloorPlanToTables(
    sections,
    toTableBounds(positioned),
    location.floorPlanWidth,
    location.floorPlanHeight
  );

  const tables = positioned.map((t, i) => ({
    ...t,
    posX: fitted.tables[i]?.posX ?? t.posX,
    posY: fitted.tables[i]?.posY ?? t.posY,
    width: fitted.tables[i]?.width ?? t.width,
    height: fitted.tables[i]?.height ?? t.height,
    reservations: t.reservations.map((r) => ({
      id: r.id,
      guestName: r.guestName,
      partySize: r.partySize,
      reservationAt: r.reservationAt.toISOString(),
      provider: r.provider,
    })),
  }));

  return (
    <div>
      <PageHeader
        title="Tables"
        description="Custom floor plan, live table status, and OpenTable / Resy reservation sync"
      />
      <TablesClient
        initialTables={tables}
        initialFloorPlan={{
          width: fitted.width,
          height: fitted.height,
          sections: fitted.sections,
        }}
      />
    </div>
  );
}
