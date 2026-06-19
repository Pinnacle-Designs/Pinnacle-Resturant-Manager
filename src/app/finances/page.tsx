import { prisma } from "@/lib/prisma";
import { getLocationId } from "@/lib/location";
import { PageHeader } from "@/components/ui";
import { FinancesClient } from "@/components/finances/FinancesClient";

export default async function FinancesPage() {
  const locationId = await getLocationId();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [expenses, recentOrders] = await Promise.all([
    prisma.expense.findMany({
      where: { locationId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "desc" },
    }),
    prisma.order.findMany({
      where: { locationId, createdAt: { gte: sevenDaysAgo }, status: "PAID" },
    }),
  ]);

  const weeklyRevenue = recentOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <div>
      <PageHeader title="Finances" description="Revenue, expenses, and profit overview" reportId="expenses" />
      <FinancesClient
        initialExpenses={expenses.map((e) => ({
          ...e,
          date: e.date.toISOString(),
        }))}
        weeklyRevenue={weeklyRevenue}
      />
    </div>
  );
}
