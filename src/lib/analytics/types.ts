export type Daypart = "breakfast" | "lunch" | "dinner" | "late";

export type MenuQuadrant = "star" | "plowhorse" | "puzzle" | "dog";

export interface AnalyticsPayload {
  generatedAt: string;
  periodDays: number;
  executive: ExecutiveSummary;
  sales: SalesAnalytics;
  foodCost: FoodCostAnalytics;
  labor: LaborAnalytics;
  menuEngineering: MenuEngineeringAnalytics;
  marketing: MarketingAnalytics;
  customerExperience: CustomerExperienceAnalytics;
  operations: OperationsAnalytics;
  purchasing: PurchasingAnalytics;
  forecasting: ForecastingAnalytics;
  profitability: ProfitabilityAnalytics;
  externalFactors: ExternalFactorsAnalytics;
  aiInsights: AnalyticsInsight[];
  coverage: AnalyticsCoverage;
}

export interface AnalyticsInsight {
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
}

export interface AnalyticsCoverage {
  sections: Array<{ id: string; label: string; covered: boolean; note?: string }>;
}

export interface ExecutiveSummary {
  yesterday: {
    sales: number;
    netSales: number;
    foodCostPct: number;
    laborPct: number;
    primeCostPct: number;
    profitEstimate: number;
    guestCount: number;
  };
  last7Days: {
    salesTrend: Array<{ date: string; sales: number }>;
    profitTrend: Array<{ date: string; profit: number }>;
    reviewTrend: Array<{ date: string; avgRating: number }>;
  };
  alerts: Array<{ type: string; message: string; severity: string }>;
}

export interface SalesAnalytics {
  totalSales: number;
  netSales: number;
  byDaypart: Array<{ daypart: Daypart; sales: number; orders: number }>;
  byHour: Array<{ hour: number; sales: number; orders: number }>;
  byMenuItem: Array<{ name: string; sales: number; quantity: number }>;
  byCategory: Array<{ category: string; sales: number; quantity: number }>;
  averageCheck: number;
  guestCount: number;
  revenuePerSeat: number;
  revenuePerLaborHour: number;
  revenuePerSqFt: number;
  byChannel: Array<{ channel: string; sales: number; profit: number }>;
  questions: string[];
}

export interface FoodCostAnalytics {
  inventoryValuation: number;
  theoreticalFoodCost: number;
  actualFoodCost: number;
  wasteCost: number;
  spoilageCost: number;
  foodCostPct: number;
  theoreticalFoodCostPct: number;
  variancePct: number;
  inventoryTurnover: number;
  daysOnHand: number;
  lowStockItems: Array<{ name: string; quantity: number; minQuantity: number }>;
  topCostDrivers: Array<{ name: string; cost: number; changePct: number }>;
  questions: string[];
}

export interface LaborAnalytics {
  scheduledHours: number;
  actualHours: number;
  overtimeHours: number;
  laborCost: number;
  laborPct: number;
  salesPerLaborHour: number;
  guestsPerLaborHour: number;
  overtimePct: number;
  laborVarianceHours: number;
  byPosition: Array<{ role: string; hours: number; cost: number }>;
  byShift: Array<{ label: string; hours: number; sales: number }>;
  questions: string[];
}

export interface MenuEngineeringItem {
  id: string;
  name: string;
  category: string;
  price: number;
  recipeCost: number;
  margin: number;
  marginPct: number;
  quantitySold: number;
  popularityPct: number;
  contribution: number;
  quadrant: MenuQuadrant;
}

export interface MenuEngineeringAnalytics {
  items: MenuEngineeringItem[];
  stars: number;
  plowhorses: number;
  puzzles: number;
  dogs: number;
  questions: string[];
}

export interface MarketingAnalytics {
  totalSpend: number;
  campaigns: Array<{
    name: string;
    channel: string;
    spend: number;
    conversions: number;
    revenue: number;
    roas: number;
  }>;
  socialEngagement: number;
  newGuests: number;
  returningGuests: number;
  repeatVisitRate: number;
  customerAcquisitionCost: number;
  lifetimeValueEstimate: number;
  questions: string[];
}

export interface CustomerExperienceAnalytics {
  avgRating: number;
  reviewCount: number;
  bySource: Array<{ source: string; count: number; avgRating: number }>;
  complaintCategories: Array<{ category: string; count: number }>;
  unresolvedCount: number;
  recentReviews: Array<{ source: string; rating: number; comment: string | null; date: string }>;
  questions: string[];
}

export interface OperationsAnalytics {
  avgTicketTimeMinutes: number;
  orderAccuracyPct: number;
  voidRatePct: number;
  discountRatePct: number;
  compRatePct: number;
  refundTotal: number;
  bottleneckDaypart: string;
  questions: string[];
}

export interface PurchasingAnalytics {
  totalPurchases: number;
  vendorCount: number;
  invoices: Array<{ vendor: string; amount: number; priceChangePct: number }>;
  costInflationPct: number;
  topVendors: Array<{ vendor: string; spend: number; orders: number }>;
  questions: string[];
}

export interface ForecastingAnalytics {
  salesForecast7d: Array<{ date: string; predicted: number }>;
  laborHoursForecast7d: Array<{ date: string; hours: number }>;
  inventoryRecommendations: Array<{ name: string; suggestedOrder: number; unit: string }>;
  seasonalNote: string;
  questions: string[];
}

export interface ProfitabilityAnalytics {
  grossProfit: number;
  netProfitEstimate: number;
  profitMarginPct: number;
  byMenuItem: Array<{ name: string; profit: number; marginPct: number }>;
  byCategory: Array<{ category: string; profit: number }>;
  byDaypart: Array<{ daypart: Daypart; profit: number }>;
  byChannel: Array<{ channel: string; profit: number }>;
  byDay: Array<{ date: string; profit: number }>;
  questions: string[];
}

export interface ExternalFactorsAnalytics {
  factors: Array<{
    date: string;
    factorType: string;
    description: string;
    impactPct: number;
  }>;
  patterns: Array<{ pattern: string; insight: string }>;
  questions: string[];
}
