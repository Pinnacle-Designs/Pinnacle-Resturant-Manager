import { prisma } from "@/lib/prisma";

export async function seedBohSample(locationId: string) {
  const existing = await prisma.menuScheduleRule.count({ where: { locationId } });
  if (existing > 0) return;

  let burntEnds = await prisma.menuItem.findFirst({
    where: { locationId, name: "Burnt Ends" },
  });
  if (!burntEnds) {
    burntEnds = await prisma.menuItem.create({
      data: {
        locationId,
        name: "Burnt Ends",
        description: "Friday special — crispy brisket points",
        price: 18.99,
        category: "Smoked Meats",
        salesCategory: "FOOD",
        stockCount: 24,
        posGridIndex: 6,
      },
    });
  }

  let jalapenoPoppers = await prisma.menuItem.findFirst({
    where: { locationId, name: "Jalapeño Poppers" },
  });
  if (!jalapenoPoppers) {
    jalapenoPoppers = await prisma.menuItem.create({
      data: {
        locationId,
        name: "Jalapeño Poppers",
        description: "Cream cheese stuffed, bacon-wrapped",
        price: 9.99,
        category: "Appetizers",
        salesCategory: "FOOD",
        posGridIndex: 15,
      },
    });
  }

  await prisma.menuScheduleRule.createMany({
    data: [
      {
        locationId,
        name: "Lunch smokehouse",
        mode: "SHOW_CATEGORIES",
        categories: "Sandwiches,Sides",
        daysOfWeek: "1,2,3,4,5",
        startTime: "11:00",
        endTime: "15:00",
        sortOrder: 0,
      },
      {
        locationId,
        name: "Full dinner menu",
        mode: "SHOW_CATEGORIES",
        categories: "Smoked Meats,Sandwiches,Sides,Appetizers,Desserts",
        daysOfWeek: "0,1,2,3,4,5,6",
        startTime: "15:00",
        endTime: "22:00",
        sortOrder: 1,
      },
      {
        locationId,
        name: "Friday burnt ends",
        mode: "SHOW_CATEGORIES",
        categories: "Smoked Meats",
        daysOfWeek: "5",
        startTime: "11:00",
        endTime: "21:00",
        sortOrder: 2,
      },
      {
        locationId,
        name: "Happy hour bar",
        mode: "HAPPY_HOUR",
        categories: "Cocktails,Beer",
        daysOfWeek: "1,2,3,4,5",
        startTime: "16:00",
        endTime: "18:00",
        priceMultiplier: 0.85,
        sortOrder: 3,
      },
    ],
  });

  await prisma.location.update({
    where: { id: locationId },
    data: { menuRevision: { increment: 1 } },
  });
}
