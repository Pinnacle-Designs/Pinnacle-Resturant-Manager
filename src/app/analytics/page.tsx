import { redirect } from "next/navigation";
import { hasPermissionInList } from "@/lib/permissions";
import { AnalyticsClient } from "@/components/analytics/AnalyticsClient";
import { getDemoPagePlan, getEmbedAwarePageUser } from "@/lib/embed-page-auth";

export default async function AnalyticsPage() {
  const user = await getEmbedAwarePageUser();
  const plan = await getDemoPagePlan();

  if (user && !hasPermissionInList(user.permissions, "view_analytics")) {
    redirect("/dashboard");
  }

  return <AnalyticsClient plan={plan} />;
}
