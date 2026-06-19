import { redirect } from "next/navigation";
import { getEnrichedSessionUser } from "@/lib/location-plan";
import { hasPermissionInList } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { ReportsClient } from "@/components/reports/ReportsClient";

export default async function ReportsPage() {
  const user = await getEnrichedSessionUser();
  if (!user || !hasPermissionInList(user.permissions, "view_analytics")) {
    redirect("/dashboard");
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Customize columns, filters, branding, and exports for every report in Pinnacle."
        showPrint={false}
      />
      <ReportsClient />
    </div>
  );
}
