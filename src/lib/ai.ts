import OpenAI from "openai";
import { prisma } from "./prisma";
import { getLocationId } from "./location";
import type { InsightCategory, InsightSeverity } from "@prisma/client";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function analyzePhoto(
  imageBase64: string,
  category: string
): Promise<{ description: string; tags: string[]; suggestedTitle: string }> {
  if (!openai) {
    return {
      description: "AI analysis unavailable — set OPENAI_API_KEY in .env",
      tags: [category.toLowerCase()],
      suggestedTitle: `${category} photo`,
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this restaurant photo (category: ${category}). Return JSON with: description (brief), tags (array of strings), suggestedTitle (short title). Focus on restaurant operations relevance.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        description: parsed.description || "No description",
        tags: parsed.tags || [],
        suggestedTitle: parsed.suggestedTitle || "Untitled",
      };
    }
  } catch (error) {
    console.error("Photo analysis error:", error);
  }

  return {
    description: "Analysis failed",
    tags: [category.toLowerCase()],
    suggestedTitle: `${category} photo`,
  };
}

export interface ReceiptData {
  description: string;
  amount: number;
  category: string;
  date: string;
  vendor: string;
  items: string[];
}

export async function analyzeReceipt(imageBase64: string): Promise<ReceiptData> {
  const fallback: ReceiptData = {
    description: "Receipt expense",
    amount: 0,
    category: "Food & Supplies",
    date: new Date().toISOString().split("T")[0],
    vendor: "Unknown vendor",
    items: [],
  };

  if (!openai) {
    return {
      ...fallback,
      description: "Receipt (manual entry required — set OPENAI_API_KEY)",
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract data from this receipt image for a restaurant expense record. Return JSON with: description (vendor + brief summary), amount (total as number), category (one of: Food & Supplies, Utilities, Maintenance, Labor, Marketing, Equipment, Insurance, Other), date (YYYY-MM-DD), vendor (store name), items (array of line item strings). Use the total amount including tax.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        description: parsed.description || parsed.vendor || "Receipt",
        amount: parseFloat(parsed.amount) || 0,
        category: parsed.category || "Food & Supplies",
        date: parsed.date || fallback.date,
        vendor: parsed.vendor || "Unknown",
        items: parsed.items || [],
      };
    }
  } catch (error) {
    console.error("Receipt OCR error:", error);
  }

  return fallback;
}

export async function generateBusinessInsights(locationId?: string): Promise<
  Array<{
    title: string;
    description: string;
    category: InsightCategory;
    severity: InsightSeverity;
    actionable: string;
  }>
> {
  const locId = locationId || (await getLocationId());

  const [inventory, menuItems, staff, recentOrders, expenses, recentPhotos] =
    await Promise.all([
      prisma.inventoryItem.findMany({ where: { locationId: locId } }),
      prisma.menuItem.findMany({ where: { locationId: locId } }),
      prisma.staffMember.findMany({ where: { locationId: locId, active: true } }),
      prisma.order.findMany({
        where: {
          locationId: locId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        include: { items: true },
      }),
      prisma.expense.findMany({
        where: {
          locationId: locId,
          date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.photo.findMany({
        where: { locationId: locId },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const lowStockItems = inventory.filter((item) => item.quantity <= item.minQuantity);
  const totalRevenue = recentOrders
    .filter((o) => o.status === "PAID")
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const unavailableItems = menuItems.filter((m) => !m.available);

  const businessSnapshot = {
    inventoryCount: inventory.length,
    lowStockItems: lowStockItems.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      min: i.minQuantity,
    })),
    menuItemCount: menuItems.length,
    unavailableMenuItems: unavailableItems.map((m) => m.name),
    activeStaff: staff.length,
    weeklyOrders: recentOrders.length,
    weeklyRevenue: totalRevenue,
    monthlyExpenses: totalExpenses,
    profitMargin: totalRevenue - totalExpenses,
    recentPhotoCount: recentPhotos.length,
  };

  if (!openai) {
    return generateRuleBasedInsights(businessSnapshot);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a restaurant business analyst. Analyze the data and identify pain points, risks, and opportunities. Return JSON with an insights array. Each insight has: title, description, category (INVENTORY|STAFFING|FINANCE|OPERATIONS|MENU|CUSTOMER|FACILITY|GENERAL), severity (LOW|MEDIUM|HIGH|CRITICAL), actionable (specific action to take). Focus on actionable pain points.",
        },
        {
          role: "user",
          content: JSON.stringify(businessSnapshot),
        },
      ],
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return parsed.insights || [];
    }
  } catch (error) {
    console.error("Insight generation error:", error);
  }

  return generateRuleBasedInsights(businessSnapshot);
}

function generateRuleBasedInsights(snapshot: {
  lowStockItems: Array<{ name: string; quantity: number; min: number }>;
  unavailableMenuItems: string[];
  weeklyOrders: number;
  weeklyRevenue: number;
  monthlyExpenses: number;
  profitMargin: number;
  activeStaff: number;
}): Array<{
  title: string;
  description: string;
  category: InsightCategory;
  severity: InsightSeverity;
  actionable: string;
}> {
  const insights: Array<{
    title: string;
    description: string;
    category: InsightCategory;
    severity: InsightSeverity;
    actionable: string;
  }> = [];

  if (snapshot.lowStockItems.length > 0) {
    insights.push({
      title: "Low Inventory Alert",
      description: `${snapshot.lowStockItems.length} items are below minimum stock levels: ${snapshot.lowStockItems.map((i) => i.name).join(", ")}`,
      category: "INVENTORY",
      severity: snapshot.lowStockItems.length > 3 ? "HIGH" : "MEDIUM",
      actionable: "Reorder low-stock items immediately and review par levels.",
    });
  }

  if (snapshot.unavailableMenuItems.length > 0) {
    insights.push({
      title: "Unavailable Menu Items",
      description: `${snapshot.unavailableMenuItems.length} menu items are marked unavailable: ${snapshot.unavailableMenuItems.join(", ")}`,
      category: "MENU",
      severity: "MEDIUM",
      actionable: "Review unavailable items — restock ingredients or remove from menu.",
    });
  }

  if (snapshot.profitMargin < 0) {
    insights.push({
      title: "Negative Profit Margin",
      description: `Expenses ($${snapshot.monthlyExpenses.toFixed(2)}) exceed revenue ($${snapshot.weeklyRevenue.toFixed(2)}) this period.`,
      category: "FINANCE",
      severity: "CRITICAL",
      actionable: "Audit expenses, review pricing, and identify cost-cutting opportunities.",
    });
  }

  if (snapshot.weeklyOrders === 0) {
    insights.push({
      title: "No Recent Orders",
      description: "No orders recorded in the past week.",
      category: "OPERATIONS",
      severity: "HIGH",
      actionable: "Review marketing efforts and customer outreach strategies.",
    });
  }

  if (snapshot.activeStaff === 0) {
    insights.push({
      title: "No Active Staff",
      description: "No staff members are currently registered as active.",
      category: "STAFFING",
      severity: "HIGH",
      actionable: "Add staff members and assign roles for proper operations.",
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "Operations Running Smoothly",
      description: "No critical pain points detected. Continue monitoring key metrics.",
      category: "GENERAL",
      severity: "LOW",
      actionable: "Keep uploading photos and logging data for better AI insights.",
    });
  }

  return insights;
}

export async function runInsightAnalysis(locationId?: string): Promise<{
  count: number;
  criticalInsights: Array<{ title: string; description: string; severity: string }>;
}> {
  const locId = locationId || (await getLocationId());
  const insights = await generateBusinessInsights(locId);

  await prisma.businessInsight.deleteMany({
    where: { locationId: locId, resolved: false },
  });

  const created = await prisma.businessInsight.createMany({
    data: insights.map((insight) => ({
      locationId: locId,
      title: insight.title,
      description: insight.description,
      category: insight.category,
      severity: insight.severity,
      actionable: insight.actionable,
      dataSnapshot: JSON.stringify(insight),
    })),
  });

  await prisma.activityLog.create({
    data: {
      locationId: locId,
      action: "AI_ANALYSIS",
      entity: "insights",
      details: `Generated ${created.count} insights`,
    },
  });

  const criticalInsights = insights
    .filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH")
    .map((i) => ({ title: i.title, description: i.description, severity: i.severity }));

  return { count: created.count, criticalInsights };
}
