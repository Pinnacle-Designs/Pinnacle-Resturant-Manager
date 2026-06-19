import { subDays, startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import { computeAnalytics } from "@/lib/analytics/compute";
import { computeAvtVariance } from "@/lib/back-office/avt-variance";
import { computeWasteDashboard } from "@/lib/back-office/waste-dashboard";
import { computeMonthlyCogs } from "@/lib/walk-in/monthly-count";
import { loadPayrollPreview } from "@/lib/payroll/load-context";
import { computeTurnoverAnalytics } from "@/lib/retention/turnover";
import { computeVendorScorecards } from "@/lib/purchasing/vendor-scorecards";
import type { ReportFilters, ReportRow } from "@/lib/reports/types";

function filterDays(filters: ReportFilters, fallback = 30): number {
  return filters.days ?? fallback;
}

function filterDateRange(filters: ReportFilters, fallbackDays = 30) {
  const to = filters.dateTo ? new Date(filters.dateTo) : new Date();
  const from = filters.dateFrom
    ? new Date(filters.dateFrom)
    : subDays(to, filterDays(filters, fallbackDays));
  return { from, to };
}

export async function fetchReportRows(
  locationId: string,
  reportId: string,
  filters: ReportFilters = {}
): Promise<ReportRow[]> {
  switch (reportId) {
    case "sales-by-item": {
      const analytics = await computeAnalytics(locationId);
      return analytics.sales.byMenuItem.map((r) => ({
        name: r.name,
        quantity: r.quantity,
        sales: r.sales,
      }));
    }
    case "sales-by-category": {
      const analytics = await computeAnalytics(locationId);
      return analytics.sales.byCategory.map((r) => ({
        category: r.category,
        quantity: r.quantity,
        sales: r.sales,
      }));
    }
    case "sales-by-daypart": {
      const analytics = await computeAnalytics(locationId);
      return analytics.sales.byDaypart.map((r) => ({
        daypart: r.daypart,
        orders: r.orders,
        sales: r.sales,
      }));
    }
    case "sales-by-channel": {
      const analytics = await computeAnalytics(locationId);
      return analytics.sales.byChannel.map((r) => ({
        channel: r.channel,
        orders: r.orders,
        sales: r.sales,
        profit: r.profit,
        marginPct: r.marginPct,
      }));
    }
    case "menu-engineering": {
      const analytics = await computeAnalytics(locationId);
      return analytics.menuEngineering.items.map((r) => ({
        name: r.name,
        quadrant: r.quadrant,
        sales: r.price * r.quantitySold,
        marginPct: r.marginPct,
        popularityPct: r.popularityPct,
        contribution: r.contribution,
      }));
    }
    case "labor-by-employee": {
      const analytics = await computeAnalytics(locationId);
      return analytics.labor.byEmployee.map((r) => ({
        name: r.name,
        role: r.role,
        scheduledHours: r.scheduledHours,
        actualHours: r.actualHours,
        overtimeHours: Math.max(0, r.actualHours - r.scheduledHours),
        laborCost: r.laborCost,
        laborPct:
          r.salesAttributed > 0 ? (r.laborCost / r.salesAttributed) * 100 : 0,
      }));
    }
    case "profit-by-employee": {
      const analytics = await computeAnalytics(locationId);
      return analytics.profitability.byEmployee.map((r) => ({
        name: r.name,
        role: r.role,
        sales: r.sales,
        profit: r.profit,
        marginPct: r.marginPct,
      }));
    }
    case "avt-variance": {
      const report = await computeAvtVariance(locationId, filterDays(filters, 30));
      return report.lines.map((r) => ({
        name: r.name,
        unit: r.unit,
        theoreticalQty: r.theoreticalQty,
        actualQty: r.actualQty,
        varianceQty: r.varianceQty,
        variancePct: r.variancePct,
        varianceCost: r.varianceCost,
        flag: r.flag,
        likelyCause: r.likelyCause ?? "",
      }));
    }
    case "waste-log": {
      const report = await computeWasteDashboard(locationId);
      return report.recent.map((r) => ({
        date: r.date.slice(0, 10),
        item: r.itemName,
        quantity: r.quantity,
        unit: r.unit,
        reason: r.reason,
        cost: r.cost,
        employee: r.employee ?? "",
        shift: r.shift ?? "",
      }));
    }
    case "monthly-variance": {
      const period = startOfMonth(new Date());
      const report = await computeMonthlyCogs(locationId, period);
      return report.varianceLines.map((r) => ({
        name: r.name,
        unit: r.unit,
        openingQty: r.openingQty,
        purchasesQty: r.purchasesQty,
        theoreticalQty: r.theoreticalQty,
        actualQty: r.actualQty,
        varianceQty: r.varianceQty,
        variancePct: r.variancePct,
        varianceCost: r.varianceCost,
        flag: r.flag,
      }));
    }
    case "inventory-on-hand": {
      const items = await prisma.inventoryItem.findMany({
        where: { locationId },
        include: { storageZone: { select: { name: true } } },
        orderBy: { name: "asc" },
      });
      return items.map((r) => ({
        name: r.name,
        category: r.storageZone?.name ?? "",
        quantity: r.quantity,
        unit: r.unit,
        minQuantity: r.minQuantity,
        costPerUnit: r.costPerUnit,
        value: r.quantity * r.costPerUnit,
        supplier: r.supplier ?? "",
        barcode: r.barcode ?? "",
      }));
    }
    case "low-stock": {
      const items = await prisma.inventoryItem.findMany({
        where: { locationId },
        orderBy: { name: "asc" },
      });
      return items
        .filter((r) => r.quantity <= r.minQuantity)
        .map((r) => ({
          name: r.name,
          quantity: r.quantity,
          minQuantity: r.minQuantity,
          unit: r.unit,
          supplier: r.supplier ?? "",
          shortfall: Math.max(0, r.minQuantity - r.quantity),
        }));
    }
    case "expenses": {
      const { from, to } = filterDateRange(filters, 30);
      const expenses = await prisma.expense.findMany({
        where: { locationId, date: { gte: from, lte: to } },
        orderBy: { date: "desc" },
      });
      return expenses.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        description: r.description,
        category: r.category,
        amount: r.amount,
        vendor: "",
      }));
    }
    case "payroll-preview": {
      const { from, to } = filterDateRange(filters, 14);
      const preview = await loadPayrollPreview(locationId, from, to);
      return preview.employees.map((r) => ({
        name: r.name,
        role: "",
        regHours: r.regularHours,
        otHours: r.overtimeHours,
        basePay: r.regularPay,
        otPay: r.overtimePay,
        tips: r.tipsAllocated,
        gross: r.grossPay,
      }));
    }
    case "compliance-incidents": {
      const { from, to } = filterDateRange(filters, 90);
      const incidents = await prisma.incidentReport.findMany({
        where: { locationId, reportedAt: { gte: from, lte: to } },
        include: { staffMember: { select: { name: true } } },
        orderBy: { reportedAt: "desc" },
      });
      return incidents.map((r) => ({
        reportedAt: r.reportedAt.toISOString().slice(0, 10),
        incidentType: r.incidentType,
        category: r.category,
        description: r.description,
        severity: r.severity,
        status: r.status,
        oshaRecordable: r.oshaRecordable ? "Yes" : "No",
        staffName: r.staffMember?.name ?? "",
      }));
    }
    case "staff-turnover": {
      const months = filters.months ?? 12;
      const analytics = await computeTurnoverAnalytics(locationId, months);
      return analytics.byRole.map((r) => ({
        role: r.role,
        activeStaff: r.active,
        departures: r.departures,
        turnoverRate: r.rate,
        avgTenure: 0,
      }));
    }
    case "vendor-scorecards": {
      const cards = await computeVendorScorecards(locationId, filterDays(filters, 90));
      return cards.map((r) => ({
        vendor: r.vendor,
        fillRatePct: r.fillRatePct,
        onTimePct: r.onTimePct,
        substitutionRatePct: r.substitutionRatePct,
        reliabilityGrade: r.reliabilityGrade,
        reliabilityScore: r.reliabilityScore,
        deliveryCount: r.deliveryCount,
      }));
    }
    case "log-book-entries": {
      const { from, to } = filterDateRange(filters, 30);
      const entries = await prisma.logBookEntry.findMany({
        where: { locationId, logDate: { gte: from, lte: to } },
        orderBy: { logDate: "desc" },
      });
      return entries.map((r) => ({
        date: r.logDate.toISOString().slice(0, 10),
        category: r.category,
        title: r.title ?? "",
        content: r.content,
        salesTotal: r.salesTotal,
        guestCount: r.guestCount,
        laborHours: r.laborHours,
      }));
    }
    default:
      throw new Error(`Unknown report: ${reportId}`);
  }
}
