import { prisma } from "@/lib/prisma";

/** Rich sample data for analytics dashboards */
export async function seedAnalyticsSampleData(locationId: string) {
  const existingOrders = await prisma.order.count({ where: { locationId } });
  if (existingOrders > 5) return;

  await prisma.location.update({
    where: { id: locationId },
    data: { seatCount: 48, squareFootage: 2400 },
  });

  const menuItems = await prisma.menuItem.findMany({ where: { locationId } });
  const recipeCosts: Record<string, number> = {
    "Grilled Salmon": 9.2,
    "Caesar Salad": 2.8,
    "Margherita Pizza": 4.1,
    "Chocolate Lava Cake": 2.2,
    "House Red Wine": 3.5,
  };
  for (const item of menuItems) {
    const rc = recipeCosts[item.name] ?? item.price * 0.28;
    await prisma.menuItem.update({ where: { id: item.id }, data: { recipeCost: rc } });
  }

  const tables = await prisma.table.findMany({ where: { locationId } });
  const staff = await prisma.staffMember.findMany({ where: { locationId } });
  const inventory = await prisma.inventoryItem.findMany({ where: { locationId } });

  const channels = ["dine-in", "delivery", "pickup", "catering"];
  const now = Date.now();

  for (let day = 0; day < 28; day++) {
    const ordersPerDay = 4 + Math.floor(Math.random() * 8);
    for (let o = 0; o < ordersPerDay; o++) {
      const hour = 7 + Math.floor(Math.random() * 14);
      const createdAt = new Date(now - day * 86400000);
      createdAt.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
      const menuItem = menuItems[Math.floor(Math.random() * menuItems.length)]!;
      const qty = 1 + Math.floor(Math.random() * 3);
      const channel = channels[Math.floor(Math.random() * channels.length)]!;
      const total = menuItem.price * qty;

      await prisma.order.create({
        data: {
          locationId,
          tableId: tables[Math.floor(Math.random() * tables.length)]?.id,
          status: "PAID",
          totalAmount: total,
          guestCount: 1 + Math.floor(Math.random() * 4),
          channel,
          discountAmount: Math.random() > 0.85 ? total * 0.1 : 0,
          compAmount: Math.random() > 0.92 ? total * 0.05 : 0,
          voidAmount: Math.random() > 0.97 ? total * 0.02 : 0,
          ticketTimeMinutes: 12 + Math.floor(Math.random() * 25),
          createdAt,
          items: {
            create: {
              menuItemId: menuItem.id,
              quantity: qty,
              price: menuItem.price,
            },
          },
        },
      });
    }
  }

  for (let day = 0; day < 14; day++) {
    const d = new Date(now - day * 86400000);
    for (const member of staff.slice(0, 3)) {
      await prisma.shift.create({
        data: {
          locationId,
          staffMemberId: member.id,
          date: d,
          startTime: day % 2 === 0 ? "09:00" : "11:00",
          endTime: day % 2 === 0 ? "17:00" : "21:00",
        },
      });
    }
  }

  await prisma.marketingCampaign.createMany({
    data: [
      { locationId, name: "Summer Instagram", channel: "instagram", spend: 850, impressions: 42000, clicks: 2100, conversions: 145, revenueAttributed: 4200, startDate: new Date(now - 20 * 86400000) },
      { locationId, name: "Google Local Ads", channel: "google", spend: 600, impressions: 18000, clicks: 890, conversions: 98, revenueAttributed: 3100, startDate: new Date(now - 25 * 86400000) },
      { locationId, name: "Email Newsletter", channel: "email", spend: 120, impressions: 5000, clicks: 420, conversions: 52, revenueAttributed: 1800, startDate: new Date(now - 10 * 86400000) },
    ],
  });

  await prisma.guestReview.createMany({
    data: [
      { locationId, source: "Google", rating: 4.5, comment: "Great salmon and fast service!", category: "service" },
      { locationId, source: "Google", rating: 3, comment: "Food was good but wait was long", category: "wait_time", resolved: false },
      { locationId, source: "OpenTable", rating: 5, comment: "Perfect date night spot", category: "ambiance" },
      { locationId, source: "Yelp", rating: 4, comment: "Loved the pizza", category: "food_quality" },
    ],
  });

  await prisma.vendorInvoice.createMany({
    data: [
      { locationId, vendor: "Ocean Fresh", amount: 1250, category: "Seafood", priceChangePct: 8.2 },
      { locationId, vendor: "Green Valley", amount: 380, category: "Produce", priceChangePct: 3.1 },
      { locationId, vendor: "Dairy Direct", amount: 520, category: "Dairy", priceChangePct: -1.2 },
      { locationId, vendor: "Bulk Foods Co", amount: 290, category: "Dry goods", priceChangePct: 4.5 },
    ],
  });

  if (inventory[0]) {
    await prisma.inventoryWaste.createMany({
      data: [
        { locationId, inventoryItemId: inventory[0].id, itemName: inventory[0].name, quantity: 2, unit: inventory[0].unit, cost: 25, reason: "spoilage" },
        { locationId, itemName: "Prep trim", quantity: 5, unit: "lbs", cost: 18, reason: "prep waste" },
      ],
    });
  }

  await prisma.externalFactor.createMany({
    data: [
      { locationId, date: new Date(now - 3 * 86400000), factorType: "weather", description: "Rainy day — delivery +25%", impactPct: 25 },
      { locationId, date: new Date(now - 7 * 86400000), factorType: "event", description: "Concert at arena nearby", impactPct: 40 },
      { locationId, date: new Date(now - 14 * 86400000), factorType: "holiday", description: "Local festival weekend", impactPct: 18 },
    ],
  });
}
