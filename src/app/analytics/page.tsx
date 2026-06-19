import { redirect } from "next/navigation";
import { getEnrichedSessionUser } from "@/lib/location-plan";
import { hasPermissionInList } from "@/lib/permissions";
import { AnalyticsClient } from "@/components/analytics/AnalyticsClient";
import type { PlanId } from "@/lib/plans";

export default async function AnalyticsPage() {
  const user = await getEnrichedSessionUser();
  if (!user || !hasPermissionInList(user.permissions, "view_analytics")) {
    redirect("/dashboard");
  }

  return <AnalyticsClient plan={(user.plan ?? "STARTER") as PlanId} />;
}
