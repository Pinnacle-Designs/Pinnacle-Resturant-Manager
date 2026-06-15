import { prisma } from "@/lib/prisma";
import { saveMenuRecipe } from "@/lib/menu/recipe";

export async function seedMenuRecipes(locationId: string) {
  const porkSandwich = await prisma.menuItem.findFirst({
    where: { locationId, name: "Pulled Pork Sandwich" },
  });
  const brisketPlate = await prisma.menuItem.findFirst({
    where: { locationId, name: "Smoked Brisket Plate" },
  });

  const pork = await prisma.inventoryItem.findFirst({
    where: { locationId, name: "Pork shoulder" },
  });
  const bun = await prisma.inventoryItem.findFirst({
    where: { locationId, name: "Brioche buns" },
  });
  const sauce = await prisma.inventoryItem.findFirst({
    where: { locationId, name: "House BBQ sauce" },
  });
  const cabbage = await prisma.inventoryItem.findFirst({
    where: { locationId, name: "Cabbage" },
  });
  const brisket = await prisma.inventoryItem.findFirst({
    where: { locationId, name: "Beef brisket" },
  });
  const mac = await prisma.inventoryItem.findFirst({
    where: { locationId, name: "Elbow macaroni" },
  });

  if (porkSandwich && pork && bun && sauce) {
    const lines = [
      { inventoryItemId: pork.id, quantity: 0.35 },
      { inventoryItemId: bun.id, quantity: 1 },
      { inventoryItemId: sauce.id, quantity: 0.04 },
    ];
    if (cabbage) lines.push({ inventoryItemId: cabbage.id, quantity: 0.12 });
    await saveMenuRecipe(locationId, porkSandwich.id, lines);
  }

  if (brisketPlate && brisket && sauce) {
    const lines = [
      { inventoryItemId: brisket.id, quantity: 0.45 },
      { inventoryItemId: sauce.id, quantity: 0.05 },
    ];
    if (mac) lines.push({ inventoryItemId: mac.id, quantity: 0.15 });
    if (cabbage) lines.push({ inventoryItemId: cabbage.id, quantity: 0.1 });
    await saveMenuRecipe(locationId, brisketPlate.id, lines);
  }
}
