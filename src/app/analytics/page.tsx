import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AnalyticsClient } from "@/components/analytics/AnalyticsClient";

export default async function AnalyticsPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "view_analytics")) {
    redirect("/");
  }

  return <AnalyticsClient />;
}
