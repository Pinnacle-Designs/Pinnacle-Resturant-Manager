import { redirect } from "next/navigation";
import { hasPermissionInList } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { BackOfficeClient } from "@/components/back-office/BackOfficeClient";
import { getEmbedAwarePageUser } from "@/lib/embed-page-auth";

export default async function BackOfficePage() {
  const user = await getEmbedAwarePageUser();
  if (user && !hasPermissionInList(user.permissions, "view_analytics")) {
    redirect("/dashboard");
  }

  return (
    <div>
      <PageHeader
        title="Back Office"
        description="Analytics & reporting — raw numbers translated into actionable decisions"
        reportId="avt-variance"
      />
      <BackOfficeClient />
    </div>
  );
}
