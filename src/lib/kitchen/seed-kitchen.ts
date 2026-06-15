import { prisma } from "@/lib/prisma";
import { ensureKitchenStations } from "@/lib/kitchen/stations";

export async function seedKitchenSample(locationId: string) {
  const stations = await ensureKitchenStations(locationId);
  const bySlug = Object.fromEntries(stations.map((s) => [s.slug, s]));

  const smokedItems = await prisma.menuItem.findMany({
    where: { locationId, category: "Smoked Meats" },
  });
  for (const item of smokedItems) {
    if (!item.kitchenStationId) {
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { kitchenStationId: bySlug.smoker?.id ?? bySlug.grill?.id, defaultCourse: "MAIN" },
      });
    }
  }

  const sideItems = await prisma.menuItem.findMany({
    where: { locationId, category: "Sides" },
  });
  for (const item of sideItems) {
    if (!item.kitchenStationId) {
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { kitchenStationId: bySlug.fry?.id ?? bySlug.cold?.id, defaultCourse: "MAIN" },
      });
    }
  }

  const sandwichItems = await prisma.menuItem.findMany({
    where: { locationId, category: "Sandwiches" },
  });
  for (const item of sandwichItems) {
    if (!item.kitchenStationId) {
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { kitchenStationId: bySlug.cold?.id, defaultCourse: "MAIN" },
      });
    }
  }

  const brisket = await prisma.menuItem.findFirst({
    where: { locationId, name: "Smoked Brisket Plate" },
  });
  const ribs = await prisma.menuItem.findFirst({
    where: { locationId, name: "St. Louis Ribs (Half Rack)" },
  });

  let combo = await prisma.menuItem.findFirst({
    where: { locationId, name: "Pitmaster Sampler" },
  });
  if (!combo && brisket && ribs) {
    combo = await prisma.menuItem.create({
      data: {
        locationId,
        name: "Pitmaster Sampler",
        description: "Brisket plate + half rack ribs",
        price: 39.99,
        category: "Smoked Meats",
        salesCategory: "FOOD",
        isCombo: true,
        defaultCourse: "MAIN",
        posGridIndex: 5,
      },
    });

    await prisma.menuComboComponent.createMany({
      data: [
        {
          comboItemId: combo.id,
          componentItemId: brisket.id,
          quantity: 1,
          kitchenStationId: bySlug.smoker?.id ?? bySlug.grill?.id,
          sortOrder: 0,
        },
        {
          comboItemId: combo.id,
          componentItemId: ribs.id,
          quantity: 1,
          kitchenStationId: bySlug.smoker?.id ?? bySlug.grill?.id,
          sortOrder: 1,
        },
      ],
    });
  }

  const sweetTea = await prisma.menuItem.findFirst({
    where: { locationId, name: "Sweet Tea" },
  });
  if (sweetTea && !sweetTea.kitchenStationId) {
    await prisma.menuItem.update({
      where: { id: sweetTea.id },
      data: {
        kitchenStationId: bySlug["service-bar"]?.id,
        defaultCourse: "BEVERAGE",
      },
    });
  }
}
