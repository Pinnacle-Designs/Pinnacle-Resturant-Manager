import { redirect } from "next/navigation";
import { getEnrichedSessionUser } from "@/lib/location-plan";
import { hasPermissionInList } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { CrystalBallClient } from "@/components/crystal-ball/CrystalBallClient";

export default async function CrystalBallPage() {
  const user = await getEnrichedSessionUser();
  if (!user || !hasPermissionInList(user.permissions, "view_analytics")) {
    redirect("/dashboard");
  }

  return (
    <div>
      <PageHeader
        title="Crystal Ball"
        description="Advanced forecasting — weather & event overlays on prep and par levels, plus sales micro-trends"
      />
      <CrystalBallClient />
    </div>
  );
}
