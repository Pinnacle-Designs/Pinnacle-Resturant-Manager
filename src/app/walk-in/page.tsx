import { PageHeader } from "@/components/ui";
import { WalkInClient } from "@/components/walk-in/WalkInClient";

export default function WalkInPage() {
  return (
    <div>
      <PageHeader
        title="Walk-In Count"
        description="Count in minutes, not hours — scan, weigh, and sync even when the cooler blocks Wi-Fi"
      />
      <WalkInClient />
    </div>
  );
}
