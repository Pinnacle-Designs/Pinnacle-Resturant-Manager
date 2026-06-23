import { redirect } from "next/navigation";
import { hasPermissionInList } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { ReportsClient } from "@/components/reports/ReportsClient";
import { getEmbedAwarePageUser } from "@/lib/embed-page-auth";

export default async function ReportsPage() {
  const user = await getEmbedAwarePageUser();
  if (user && !hasPermissionInList(user.permissions, "view_analytics")) {
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
