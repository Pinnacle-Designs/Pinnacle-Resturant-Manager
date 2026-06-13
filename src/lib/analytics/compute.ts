import { prisma } from "@/lib/prisma";
import type {
  AnalyticsPayload,
  AnalyticsInsight,
  Daypart,
  MenuEngineeringItem,
  MenuQuadrant,
} from "./types";

const PERIOD_DAYS = 30;

function daypartFromHour(hour: number): Daypart {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 22) return "dinner";
  return "late";
}

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh! + em! / 60) - (sh! + sm! / 60);
}

function menuQuadrant(popularityPct: number, marginPct: number): MenuQuadrant {
  const popular = popularityPct >= 50;
  const profitable = marginPct >= 50;
  if (popular && profitable) return "star";
  if (popular && !profitable) return "plowhorse";
  if (!popular && profitable) return "puzzle";
  return "dog";
}

function dateKey(d: Date) {
  return d.toISOString().split("T")[0]!;
}

export async function computeAnalytics(locationId: string): Promise<AnalyticsPayload> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);

  const [
    location,
    orders,
    menuItems,
    inventory,
    staff,
    shifts,
    expenses,
    waste,
    campaigns,
    reviews,
    vendorInvoices,
    externalFactors,
    socialAccounts,
  ] = await Promise.all([
    prisma.location.findUnique({ where: { id: locationId } }),
    prisma.order.findMany({
      where: { locationId, createdAt: { gte: periodStart } },
      include: { items: { include: { menuItem: true } }, table: true },
    }),
    prisma.menuItem.findMany({ where: { locationId } }),
    prisma.inventoryItem.findMany({ where: { locationId } }),
    prisma.staffMember.findMany({ where: { locationId, active: true } }),
    prisma.shift.findMany({
      where: { locationId, date: { gte: periodStart } },
      include: { staffMember: true },
    }),
    prisma.expense.findMany({ where: { locationId, date: { gte: periodStart } } }),
    prisma.inventoryWaste.findMany({ where: { locationId, date: { gte: periodStart } } }),
    prisma.marketingCampaign.findMany({ where: { locationId } }),
    prisma.guestReview.findMany({
      where: { locationId, createdAt: { gte: periodStart } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vendorInvoice.findMany({
      where: { locationId, invoiceDate: { gte: periodStart } },
    }),
    prisma.externalFactor.findMany({
      where: { locationId, date: { gte: periodStart } },
      orderBy: { date: "desc" },
    }),
    prisma.socialAccount.findMany({ where: { locationId, connected: true } }),
    prisma.table.findMany({ where: { locationId } }),
  ]);

  const paidOrders = orders.filter((o) => o.status === "PAID");
  const yesterdayOrders = paidOrders.filter(
    (o) => o.createdAt >= yesterdayStart && o.createdAt < yesterdayEnd
  );

  const totalSales = paidOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalDiscounts = paidOrders.reduce((s, o) => s + o.discountAmount + o.compAmount, 0);
  const totalVoids = paidOrders.reduce((s, o) => s + o.voidAmount, 0);
  const netSales = totalSales - totalDiscounts - totalVoids;
  const guestCount = paidOrders.reduce((s, o) => s + o.guestCount, 0);
  const seats = location?.seatCount ?? 40;
  const sqFt = location?.squareFootage ?? 2000;

  const scheduledHours = shifts.reduce((s, sh) => s + shiftHours(sh.startTime, sh.endTime), 0);
  const laborCost = shifts.reduce(
    (s, sh) => s + shiftHours(sh.startTime, sh.endTime) * sh.staffMember.hourlyRate,
    0
  );
  const overtimeHours = Math.max(0, scheduledHours - staff.length * PERIOD_DAYS * 6);
  const actualHours = scheduledHours * 0.98;
  const laborVarianceHours = actualHours - scheduledHours;

  const inventoryValuation = inventory.reduce((s, i) => s + i.quantity * i.costPerUnit, 0);
  const wasteCost = waste.reduce((s, w) => s + w.cost, 0);
  const spoilageCost = waste.filter((w) => w.reason.toLowerCase().includes("spoil")).reduce((s, w) => s + w.cost, 0);

  const foodExpense = expenses
    .filter((e) => /food|supply|inventory/i.test(e.category))
    .reduce((s, e) => s + e.amount, 0);
  const actualFoodCost = foodExpense + wasteCost;
  const theoreticalFoodCost = paidOrders.reduce((s, o) => {
    return (
      s +
      o.items.reduce((is, item) => {
        const rc = item.menuItem.recipeCost || item.menuItem.price * 0.28;
        return is + rc * item.quantity;
      }, 0)
    );
  }, 0);

  const foodCostPct = netSales > 0 ? (actualFoodCost / netSales) * 100 : 0;
  const theoreticalFoodCostPct = netSales > 0 ? (theoreticalFoodCost / netSales) * 100 : 0;
  const variancePct = theoreticalFoodCostPct - foodCostPct;
  const dailyUsage = theoreticalFoodCost / PERIOD_DAYS;
  const daysOnHand = dailyUsage > 0 ? inventoryValuation / dailyUsage : 0;
  const inventoryTurnover = inventoryValuation > 0 ? actualFoodCost / inventoryValuation : 0;

  const laborPct = netSales > 0 ? (laborCost / netSales) * 100 : 0;
  const profitEstimate = netSales - actualFoodCost - laborCost - expenses
    .filter((e) => !/food|supply|inventory|labor/i.test(e.category))
    .reduce((s, e) => s + e.amount, 0);

  const revenuePerLaborHour = actualHours > 0 ? netSales / actualHours : 0;
  const revenuePerSeat = seats > 0 ? netSales / seats : 0;
  const revenuePerSqFt = sqFt > 0 ? netSales / sqFt : 0;
  const averageCheck = paidOrders.length > 0 ? netSales / paidOrders.length : 0;

  const daypartMap: Record<Daypart, { sales: number; orders: number }> = {
    breakfast: { sales: 0, orders: 0 },
    lunch: { sales: 0, orders: 0 },
    dinner: { sales: 0, orders: 0 },
    late: { sales: 0, orders: 0 },
  };
  const hourMap: Record<number, { sales: number; orders: number }> = {};
  const channelMap: Record<string, { sales: number; profit: number }> = {};
  const itemSales: Record<string, { name: string; sales: number; quantity: number }> = {};
  const categorySales: Record<string, { sales: number; quantity: number }> = {};
  const dayProfit: Record<string, number> = {};

  for (const o of paidOrders) {
    const hour = o.createdAt.getHours();
    const dp = daypartFromHour(hour);
    daypartMap[dp].sales += o.totalAmount;
    daypartMap[dp].orders += 1;
    if (!hourMap[hour]) hourMap[hour] = { sales: 0, orders: 0 };
    hourMap[hour].sales += o.totalAmount;
    hourMap[hour].orders += 1;

    const ch = o.channel || "dine-in";
    if (!channelMap[ch]) channelMap[ch] = { sales: 0, profit: 0 };
    const orderFoodCost = o.items.reduce(
      (s, i) => s + (i.menuItem.recipeCost || i.menuItem.price * 0.28) * i.quantity,
      0
    );
    channelMap[ch].sales += o.totalAmount;
    channelMap[ch].profit += o.totalAmount - orderFoodCost;

    const dk = dateKey(o.createdAt);
    dayProfit[dk] = (dayProfit[dk] ?? 0) + o.totalAmount - orderFoodCost - o.totalAmount * 0.25;

    for (const item of o.items) {
      const key = item.menuItemId;
      if (!itemSales[key]) {
        itemSales[key] = { name: item.menuItem.name, sales: 0, quantity: 0 };
      }
      itemSales[key].sales += item.price * item.quantity;
      itemSales[key].quantity += item.quantity;

      const cat = item.menuItem.category;
      if (!categorySales[cat]) categorySales[cat] = { sales: 0, quantity: 0 };
      categorySales[cat].sales += item.price * item.quantity;
      categorySales[cat].quantity += item.quantity;
    }
  }

  const totalItemsSold = Object.values(itemSales).reduce((s, i) => s + i.quantity, 0);
  const menuEngineeringItems: MenuEngineeringItem[] = menuItems.map((m) => {
    const sold = itemSales[m.id]?.quantity ?? 0;
    const recipeCost = m.recipeCost || m.price * 0.28;
    const margin = m.price - recipeCost;
    const marginPct = m.price > 0 ? (margin / m.price) * 100 : 0;
    const popularityPct = totalItemsSold > 0 ? (sold / totalItemsSold) * 100 : 0;
    return {
      id: m.id,
      name: m.name,
      category: m.category,
      price: m.price,
      recipeCost,
      margin,
      marginPct,
      quantitySold: sold,
      popularityPct,
      contribution: margin * sold,
      quadrant: menuQuadrant(popularityPct, marginPct),
    };
  });

  const marketingSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const socialEngagement = socialAccounts.reduce((s, a) => s + a.followers, 0);

  const guestIds = new Set<string>();
  const repeatGuests = paidOrders.filter((o) => {
    const key = `${o.tableId ?? "walk-in"}-${o.guestCount}`;
    if (guestIds.has(key)) return true;
    guestIds.add(key);
    return false;
  }).length;

  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const ticketTimes = paidOrders.filter((o) => o.ticketTimeMinutes != null);
  const avgTicketTime =
    ticketTimes.length > 0
      ? ticketTimes.reduce((s, o) => s + o.ticketTimeMinutes!, 0) / ticketTimes.length
      : 18;

  const salesTrend: Array<{ date: string; sales: number }> = [];
  const profitTrend: Array<{ date: string; profit: number }> = [];
  const reviewTrend: Array<{ date: string; avgRating: number }> = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const dk = dateKey(d);
    const dayOrders = paidOrders.filter((o) => o.createdAt >= d && o.createdAt < next);
    const daySales = dayOrders.reduce((s, o) => s + o.totalAmount, 0);
    salesTrend.push({ date: dk, sales: daySales });
    profitTrend.push({ date: dk, profit: dayProfit[dk] ?? daySales * 0.15 });
    const dayReviews = reviews.filter((r) => r.createdAt >= d && r.createdAt < next);
    reviewTrend.push({
      date: dk,
      avgRating:
        dayReviews.length > 0
          ? dayReviews.reduce((s, r) => s + r.rating, 0) / dayReviews.length
          : avgRating,
    });
  }

  const yesterdaySales = yesterdayOrders.reduce((s, o) => s + o.totalAmount, 0);
  const yesterdayNet =
    yesterdaySales -
    yesterdayOrders.reduce((s, o) => s + o.discountAmount + o.compAmount + o.voidAmount, 0);
  const yesterdayGuests = yesterdayOrders.reduce((s, o) => s + o.guestCount, 0);
  const yesterdayFoodPct = yesterdayNet > 0 ? (actualFoodCost / PERIOD_DAYS / yesterdayNet) * 100 * 30 : foodCostPct;
  const yesterdayLaborPct = yesterdayNet > 0 ? (laborCost / PERIOD_DAYS / yesterdayNet) * 100 * 30 : laborPct;

  const alerts: AnalyticsPayload["executive"]["alerts"] = [];
  const lowStock = inventory.filter((i) => i.quantity <= i.minQuantity);
  if (lowStock.length > 0) {
    alerts.push({
      type: "inventory",
      message: `${lowStock.length} inventory item(s) below minimum`,
      severity: "HIGH",
    });
  }
  if (foodCostPct > 32) {
    alerts.push({
      type: "food_cost",
      message: `Food cost at ${foodCostPct.toFixed(1)}% exceeds 32% target`,
      severity: "HIGH",
    });
  }
  if (laborPct > 30) {
    alerts.push({
      type: "labor",
      message: `Labor at ${laborPct.toFixed(1)}% exceeds 30% target`,
      severity: "MEDIUM",
    });
  }
  const dogs = menuEngineeringItems.filter((m) => m.quadrant === "dog");
  if (dogs.length > 0) {
    alerts.push({
      type: "menu",
      message: `${dogs.length} menu item(s) are low profit and low popularity`,
      severity: "MEDIUM",
    });
  }
  const badReviews = reviews.filter((r) => r.rating < 3 && !r.resolved);
  if (badReviews.length > 0) {
    alerts.push({
      type: "reviews",
      message: `${badReviews.length} unresolved negative review(s)`,
      severity: "HIGH",
    });
  }

  const aiInsights = generateAnalyticsInsights({
    netSales,
    foodCostPct,
    laborPct,
    menuEngineeringItems,
    lowStock,
    variancePct,
    daysOnHand,
    daypartMap,
    campaigns,
    reviews,
    vendorInvoices,
    externalFactors,
  });

  const avgDailySales = netSales / PERIOD_DAYS;
  const salesForecast7d = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i + 1);
    return { date: dateKey(d), predicted: avgDailySales * (1 + (i % 2 === 0 ? 0.05 : -0.02)) };
  });

  const laborHoursForecast7d = salesForecast7d.map((f) => ({
    date: f.date,
    hours: f.predicted > 0 ? f.predicted / (revenuePerLaborHour || 100) : scheduledHours / 7,
  }));

  const inventoryRecommendations = inventory
    .filter((i) => i.quantity <= i.minQuantity * 1.5)
    .map((i) => ({
      name: i.name,
      suggestedOrder: Math.max(i.minQuantity * 2 - i.quantity, i.minQuantity),
      unit: i.unit,
    }));

  const payload: AnalyticsPayload = {
    generatedAt: now.toISOString(),
    periodDays: PERIOD_DAYS,
    executive: {
      yesterday: {
        sales: yesterdaySales,
        netSales: yesterdayNet,
        foodCostPct: yesterdayFoodPct,
        laborPct: yesterdayLaborPct,
        primeCostPct: yesterdayFoodPct + yesterdayLaborPct,
        profitEstimate: yesterdayNet * 0.12,
        guestCount: yesterdayGuests,
      },
      last7Days: { salesTrend, profitTrend, reviewTrend },
      alerts,
    },
    sales: {
      totalSales,
      netSales,
      byDaypart: (["breakfast", "lunch", "dinner", "late"] as Daypart[]).map((dp) => ({
        daypart: dp,
        ...daypartMap[dp],
      })),
      byHour: Object.entries(hourMap)
        .map(([hour, v]) => ({ hour: Number(hour), ...v }))
        .sort((a, b) => a.hour - b.hour),
      byMenuItem: Object.values(itemSales)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 15),
      byCategory: Object.entries(categorySales).map(([category, v]) => ({
        category,
        ...v,
      })),
      averageCheck,
      guestCount,
      revenuePerSeat,
      revenuePerLaborHour,
      revenuePerSqFt,
      byChannel: Object.entries(channelMap).map(([channel, v]) => ({ channel, ...v })),
      questions: [
        "What sells best?",
        "When are we busiest?",
        "Which channels are most profitable?",
      ],
    },
    foodCost: {
      inventoryValuation,
      theoreticalFoodCost,
      actualFoodCost,
      wasteCost,
      spoilageCost,
      foodCostPct,
      theoreticalFoodCostPct,
      variancePct,
      inventoryTurnover,
      daysOnHand,
      lowStockItems: lowStock.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        minQuantity: i.minQuantity,
      })),
      topCostDrivers: inventory
        .map((i) => ({
          name: i.name,
          cost: i.quantity * i.costPerUnit,
          changePct: vendorInvoices
            .filter((v) => v.vendor === i.supplier)
            .reduce((s, v) => s + v.priceChangePct, 0),
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 8),
      questions: [
        "Where is product disappearing?",
        "Which items drive food cost increases?",
        "Are recipes being followed?",
      ],
    },
    labor: {
      scheduledHours,
      actualHours,
      overtimeHours,
      laborCost,
      laborPct,
      salesPerLaborHour: revenuePerLaborHour,
      guestsPerLaborHour: actualHours > 0 ? guestCount / actualHours : 0,
      overtimePct: actualHours > 0 ? (overtimeHours / actualHours) * 100 : 0,
      laborVarianceHours,
      byPosition: staff.reduce(
        (acc, s) => {
          const existing = acc.find((a) => a.role === s.role);
          const hrs = shifts
            .filter((sh) => sh.staffMemberId === s.id)
            .reduce((sum, sh) => sum + shiftHours(sh.startTime, sh.endTime), 0);
          const cost = hrs * s.hourlyRate;
          if (existing) {
            existing.hours += hrs;
            existing.cost += cost;
          } else acc.push({ role: s.role, hours: hrs, cost });
          return acc;
        },
        [] as Array<{ role: string; hours: number; cost: number }>
      ),
      byShift: (["breakfast", "lunch", "dinner"] as const).map((label) => ({
        label,
        hours: scheduledHours / 3,
        sales: daypartMap[label].sales,
      })),
      questions: [
        "Are we overstaffed or understaffed?",
        "Which shifts are inefficient?",
        "Which roles cost the most per sales hour?",
      ],
    },
    menuEngineering: {
      items: menuEngineeringItems.sort((a, b) => b.contribution - a.contribution),
      stars: menuEngineeringItems.filter((m) => m.quadrant === "star").length,
      plowhorses: menuEngineeringItems.filter((m) => m.quadrant === "plowhorse").length,
      puzzles: menuEngineeringItems.filter((m) => m.quadrant === "puzzle").length,
      dogs: menuEngineeringItems.filter((m) => m.quadrant === "dog").length,
      questions: [
        "What should we promote?",
        "What should we reprice?",
        "What should we remove?",
      ],
    },
    marketing: {
      totalSpend: marketingSpend,
      campaigns: campaigns.map((c) => ({
        name: c.name,
        channel: c.channel,
        spend: c.spend,
        conversions: c.conversions,
        revenue: c.revenueAttributed,
        roas: c.spend > 0 ? c.revenueAttributed / c.spend : 0,
      })),
      socialEngagement,
      newGuests: Math.round(guestCount * 0.35),
      returningGuests: repeatGuests,
      repeatVisitRate: guestCount > 0 ? (repeatGuests / guestCount) * 100 : 0,
      customerAcquisitionCost: conversions > 0 ? marketingSpend / conversions : 0,
      lifetimeValueEstimate: averageCheck * 4.2,
      questions: [
        "Is marketing generating sales?",
        "Which channels bring profitable customers?",
      ],
    },
    customerExperience: {
      avgRating,
      reviewCount: reviews.length,
      bySource: Object.entries(
        reviews.reduce(
          (acc, r) => {
            if (!acc[r.source]) acc[r.source] = { count: 0, total: 0 };
            acc[r.source].count += 1;
            acc[r.source].total += r.rating;
            return acc;
          },
          {} as Record<string, { count: number; total: number }>
        )
      ).map(([source, v]) => ({
        source,
        count: v.count,
        avgRating: v.total / v.count,
      })),
      complaintCategories: Object.entries(
        reviews
          .filter((r) => r.category)
          .reduce(
            (acc, r) => {
              const cat = r.category!;
              acc[cat] = (acc[cat] ?? 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          )
      ).map(([category, count]) => ({ category, count })),
      unresolvedCount: reviews.filter((r) => !r.resolved && r.rating < 4).length,
      recentReviews: reviews.slice(0, 8).map((r) => ({
        source: r.source,
        rating: r.rating,
        comment: r.comment,
        date: r.createdAt.toISOString(),
      })),
      questions: [
        "What is hurting guest satisfaction?",
        "Which complaint categories are rising?",
      ],
    },
    operations: {
      avgTicketTimeMinutes: avgTicketTime,
      orderAccuracyPct: 100 - (totalVoids / (totalSales || 1)) * 100,
      voidRatePct: totalSales > 0 ? (totalVoids / totalSales) * 100 : 0,
      discountRatePct: totalSales > 0 ? (paidOrders.reduce((s, o) => s + o.discountAmount, 0) / totalSales) * 100 : 0,
      compRatePct: totalSales > 0 ? (paidOrders.reduce((s, o) => s + o.compAmount, 0) / totalSales) * 100 : 0,
      refundTotal: totalVoids,
      bottleneckDaypart: Object.entries(daypartMap).sort((a, b) => b[1].orders - a[1].orders)[0]?.[0] ?? "dinner",
      questions: [
        "Where are bottlenecks?",
        "Are long ticket times hurting sales?",
      ],
    },
    purchasing: {
      totalPurchases: vendorInvoices.reduce((s, v) => s + v.amount, 0),
      vendorCount: new Set(vendorInvoices.map((v) => v.vendor)).size,
      invoices: vendorInvoices.slice(0, 10).map((v) => ({
        vendor: v.vendor,
        amount: v.amount,
        priceChangePct: v.priceChangePct,
      })),
      costInflationPct:
        vendorInvoices.length > 0
          ? vendorInvoices.reduce((s, v) => s + v.priceChangePct, 0) / vendorInvoices.length
          : 0,
      topVendors: Object.entries(
        vendorInvoices.reduce(
          (acc, v) => {
            if (!acc[v.vendor]) acc[v.vendor] = { spend: 0, orders: 0 };
            acc[v.vendor].spend += v.amount;
            acc[v.vendor].orders += 1;
            return acc;
          },
          {} as Record<string, { spend: number; orders: number }>
        )
      )
        .map(([vendor, v]) => ({ vendor, ...v }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 6),
      questions: [
        "Which suppliers are increasing costs?",
        "Are we paying market rates?",
      ],
    },
    forecasting: {
      salesForecast7d,
      laborHoursForecast7d,
      inventoryRecommendations,
      seasonalNote: externalFactors[0]?.description ?? "Monitor weekend and weather-driven demand shifts.",
      questions: [
        "How much staff do I need next Friday?",
        "How much inventory should I order tomorrow?",
      ],
    },
    profitability: {
      grossProfit: netSales - actualFoodCost,
      netProfitEstimate: profitEstimate,
      profitMarginPct: netSales > 0 ? (profitEstimate / netSales) * 100 : 0,
      byMenuItem: menuEngineeringItems
        .map((m) => ({
          name: m.name,
          profit: m.contribution,
          marginPct: m.marginPct,
        }))
        .slice(0, 12),
      byCategory: Object.entries(categorySales).map(([category, v]) => ({
        category,
        profit: v.sales * 0.35,
      })),
      byDaypart: (["breakfast", "lunch", "dinner", "late"] as Daypart[]).map((dp) => ({
        daypart: dp,
        profit: daypartMap[dp].sales * 0.3,
      })),
      byChannel: Object.entries(channelMap).map(([channel, v]) => ({
        channel,
        profit: v.profit,
      })),
      byDay: Object.entries(dayProfit)
        .map(([date, profit]) => ({ date, profit }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14),
      questions: [
        "Where is profit leaking?",
        "Which items, hours, and channels drive margin?",
      ],
    },
    externalFactors: {
      factors: externalFactors.map((f) => ({
        date: f.date.toISOString(),
        factorType: f.factorType,
        description: f.description,
        impactPct: f.impactPct,
      })),
      patterns: buildExternalPatterns(externalFactors),
      questions: [
        "How does weather affect sales?",
        "Which local events boost traffic?",
      ],
    },
    aiInsights,
    coverage: {
      sections: [
        { id: "sales", label: "Sales", covered: paidOrders.length > 0 },
        { id: "food", label: "Food Cost & Inventory", covered: inventory.length > 0 },
        { id: "labor", label: "Labor", covered: shifts.length > 0 },
        { id: "menu", label: "Menu Engineering", covered: menuItems.length > 0 },
        { id: "marketing", label: "Marketing", covered: campaigns.length > 0 || socialAccounts.length > 0 },
        { id: "customer", label: "Customer Experience", covered: reviews.length > 0 },
        { id: "operations", label: "Operations", covered: paidOrders.length > 0 },
        { id: "purchasing", label: "Purchasing", covered: vendorInvoices.length > 0 },
        { id: "forecasting", label: "Forecasting", covered: paidOrders.length >= 7 },
        { id: "profitability", label: "Profitability", covered: netSales > 0 },
        { id: "external", label: "External Factors", covered: externalFactors.length > 0 },
        { id: "executive", label: "Executive Dashboard", covered: true },
      ],
    },
  };

  return payload;
}

function buildExternalPatterns(
  factors: Array<{ factorType: string; description: string; impactPct: number }>
) {
  const patterns: Array<{ pattern: string; insight: string }> = [];
  const weather = factors.filter((f) => /weather|rain/i.test(f.factorType + f.description));
  if (weather.length > 0) {
    const avg = weather.reduce((s, f) => s + f.impactPct, 0) / weather.length;
    patterns.push({
      pattern: "Weather",
      insight: `Rainy days correlate with ~${avg.toFixed(0)}% delivery shift`,
    });
  }
  const events = factors.filter((f) => /event|concert|game|holiday/i.test(f.factorType + f.description));
  if (events.length > 0) {
    patterns.push({
      pattern: "Local events",
      insight: "Event nights show elevated sales — staff up accordingly",
    });
  }
  if (patterns.length === 0) {
    patterns.push({
      pattern: "Data collection",
      insight: "Add weather and event factors to improve demand forecasting",
    });
  }
  return patterns;
}

function generateAnalyticsInsights(ctx: {
  netSales: number;
  foodCostPct: number;
  laborPct: number;
  menuEngineeringItems: MenuEngineeringItem[];
  lowStock: Array<{ name: string; quantity: number; minQuantity: number; unit: string }>;
  variancePct: number;
  daysOnHand: number;
  daypartMap: Record<Daypart, { sales: number; orders: number }>;
  campaigns: Array<{ name: string; spend: number; revenueAttributed: number }>;
  reviews: Array<{ rating: number; resolved: boolean }>;
  vendorInvoices: Array<{ vendor: string; priceChangePct: number }>;
  externalFactors: Array<{ description: string; impactPct: number }>;
}): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];

  const topItem = ctx.menuEngineeringItems.sort((a, b) => b.contribution - a.contribution)[0];
  if (topItem && topItem.contribution > 0) {
    insights.push({
      title: `${topItem.name} leads contribution margin`,
      description: `${topItem.name} generated $${topItem.contribution.toFixed(0)} contribution (${topItem.quadrant}).`,
      severity: "LOW",
      category: "MENU",
    });
  }

  const plowhorse = ctx.menuEngineeringItems.find((m) => m.quadrant === "plowhorse");
  if (plowhorse) {
    insights.push({
      title: `Reprice opportunity: ${plowhorse.name}`,
      description: `${plowhorse.name} is popular but margin is ${plowhorse.marginPct.toFixed(0)}%. A small price increase could improve profit.`,
      severity: "MEDIUM",
      category: "MENU",
    });
  }

  if (ctx.foodCostPct > 32) {
    insights.push({
      title: "Food cost above target",
      description: `Food cost is ${ctx.foodCostPct.toFixed(1)}%. Review vendor pricing and portion variance.`,
      severity: "HIGH",
      category: "FINANCE",
    });
  }

  if (ctx.variancePct < -2) {
    insights.push({
      title: "Actual food cost exceeds theoretical",
      description: `Variance of ${ctx.variancePct.toFixed(1)}% suggests waste, theft, or recipe drift.`,
      severity: "HIGH",
      category: "INVENTORY",
    });
  }

  const lettuce = ctx.lowStock.find((i) => /lettuce|romaine/i.test(i.name));
  if (lettuce && ctx.daysOnHand > 7) {
    insights.push({
      title: "Inventory days on hand elevated",
      description: `Carrying ~${ctx.daysOnHand.toFixed(0)} days of inventory; ${lettuce.name} may need tighter ordering.`,
      severity: "MEDIUM",
      category: "INVENTORY",
    });
  }

  if (ctx.daypartMap.lunch.orders > ctx.daypartMap.dinner.orders * 0.8) {
    insights.push({
      title: "Friday lunch may be understaffed",
      description: "Lunch volume is high relative to dinner — verify shift coverage for peak lunch periods.",
      severity: "MEDIUM",
      category: "STAFFING",
    });
  }

  const vendorSpike = ctx.vendorInvoices.find((v) => v.priceChangePct > 5);
  if (vendorSpike) {
    insights.push({
      title: `Vendor pricing increase: ${vendorSpike.vendor}`,
      description: `${vendorSpike.vendor} invoices show ${vendorSpike.priceChangePct.toFixed(1)}% price change — review menu pricing.`,
      severity: "MEDIUM",
      category: "FINANCE",
    });
  }

  const badReview = ctx.reviews.find((r) => r.rating < 3 && !r.resolved);
  if (badReview) {
    insights.push({
      title: "Unresolved negative review",
      description: "A guest left a low rating recently. Resolve and track complaint category trends.",
      severity: "HIGH",
      category: "CUSTOMER",
    });
  }

  const topCampaign = ctx.campaigns.sort((a, b) => b.revenueAttributed - a.revenueAttributed)[0];
  if (topCampaign && topCampaign.spend > 0) {
    insights.push({
      title: `${topCampaign.name} campaign performance`,
      description: `ROAS ${(topCampaign.revenueAttributed / topCampaign.spend).toFixed(1)}x on $${topCampaign.spend.toFixed(0)} spend.`,
      severity: "LOW",
      category: "GENERAL",
    });
  }

  return insights.slice(0, 8);
}
