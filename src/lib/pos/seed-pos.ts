import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORY_COLORS } from "@/lib/pos/colors";

export async function seedPosSample(locationId: string) {
  const existing = await prisma.modifierGroup.count({ where: { locationId } });
  if (existing > 0) return;

  for (const [category, style] of Object.entries(DEFAULT_CATEGORY_COLORS)) {
    await prisma.posCategoryStyle.upsert({
      where: { locationId_category: { locationId, category } },
      create: { locationId, category, color: style.color, icon: style.icon },
      update: { color: style.color, icon: style.icon },
    });
  }

  const brisket = await prisma.menuItem.findFirst({
    where: { locationId, name: "Smoked Brisket Plate" },
  });
  if (!brisket) return;

  let brisketSandwich = await prisma.menuItem.findFirst({
    where: { locationId, name: "Brisket Sandwich" },
  });
  if (!brisketSandwich) {
    brisketSandwich = await prisma.menuItem.create({
      data: {
        locationId,
        name: "Brisket Sandwich",
        description: "Chopped brisket, pickles, slaw on brioche",
        price: 16.99,
        category: "Sandwiches",
        salesCategory: "FOOD",
        posGridIndex: 4,
      },
    });
  }

  const bakedBeans = await prisma.menuItem.findFirst({
    where: { locationId, name: "Baked Beans" },
  });
  if (!bakedBeans) {
    await prisma.menuItem.create({
      data: {
        locationId,
        name: "Baked Beans",
        description: "Sweet molasses pit beans",
        price: 4.99,
        category: "Sides",
        salesCategory: "FOOD",
        posGridIndex: 12,
      },
    });
  }

  const cornbread = await prisma.menuItem.findFirst({
    where: { locationId, name: "Cornbread" },
  });
  if (!cornbread) {
    await prisma.menuItem.create({
      data: {
        locationId,
        name: "Cornbread",
        description: "Cast-iron skillet, honey butter",
        price: 4.49,
        category: "Sides",
        salesCategory: "FOOD",
        posGridIndex: 13,
      },
    });
  }

  const beerExisting = await prisma.menuItem.findFirst({ where: { locationId, name: "Draft Beer" } });
  if (!beerExisting) {
    await prisma.menuItem.create({
      data: {
        locationId,
        name: "Draft Beer",
        description: "Local craft lager on tap",
        price: 6.99,
        category: "Beer",
        salesCategory: "DRAFT_BEER",
        posGridIndex: 21,
      },
    });
  }

  const cocktail = await prisma.menuItem.findFirst({ where: { locationId, name: "Bourbon Lemonade" } });
  if (!cocktail) {
    await prisma.menuItem.create({
      data: {
        locationId,
        name: "Bourbon Lemonade",
        description: "House bourbon, fresh lemonade, mint",
        price: 11.99,
        category: "Cocktails",
        salesCategory: "LIQUOR",
        posGridIndex: 22,
      },
    });
  }

  await prisma.modifierGroup.create({
    data: {
      locationId,
      name: "BBQ sauce",
      slug: "bbq-sauce",
      menuItemId: brisket.id,
      required: true,
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 0,
      options: {
        create: [
          { name: "Sweet Texas", sortOrder: 0, isDefault: true },
          { name: "Spicy Chipotle", sortOrder: 1 },
          { name: "Carolina Vinegar", sortOrder: 2 },
          { name: "Alabama White", sortOrder: 3 },
        ],
      },
    },
  });

  await prisma.modifierGroup.create({
    data: {
      locationId,
      name: "Choose two sides",
      slug: "plate-sides",
      menuItemId: brisket.id,
      required: true,
      minSelect: 2,
      maxSelect: 2,
      sortOrder: 1,
      options: {
        create: [
          { name: "Mac & Cheese", sortOrder: 0, isDefault: true },
          { name: "Coleslaw", sortOrder: 1, isDefault: true },
          { name: "Baked Beans", sortOrder: 2 },
          { name: "Cornbread", sortOrder: 3 },
        ],
      },
    },
  });

  const porkSandwich = await prisma.menuItem.findFirst({
    where: { locationId, name: "Pulled Pork Sandwich" },
  });
  if (porkSandwich) {
    await prisma.modifierGroup.create({
      data: {
        locationId,
        name: "Sandwich sauce",
        slug: "sandwich-sauce",
        categories: "Sandwiches",
        required: false,
        minSelect: 0,
        maxSelect: 1,
        sortOrder: 2,
        options: {
          create: [
            { name: "Sweet Texas", sortOrder: 0, isDefault: true },
            { name: "Carolina Vinegar", sortOrder: 1 },
            { name: "Alabama White", sortOrder: 2 },
            { name: "Sauce on the side", sortOrder: 3 },
          ],
        },
      },
    });

    await prisma.modifierGroup.create({
      data: {
        locationId,
        name: "Sandwich extras",
        slug: "sandwich-extras",
        categories: "Sandwiches",
        required: false,
        minSelect: 0,
        maxSelect: 3,
        sortOrder: 3,
        options: {
          create: [
            { name: "Extra pork", sortOrder: 0, priceDelta: 3.5 },
            { name: "Add pickles", sortOrder: 1 },
            { name: "No slaw", sortOrder: 2 },
            { name: "Extra slaw", sortOrder: 3, priceDelta: 1 },
          ],
        },
      },
    });
  }

  const items = await prisma.menuItem.findMany({ where: { locationId, posGridIndex: null } });
  let idx = 40;
  for (const item of items) {
    await prisma.menuItem.update({
      where: { id: item.id },
      data: { posGridIndex: idx++ },
    });
  }
}
