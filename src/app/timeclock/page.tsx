import { PageHeader } from "@/components/ui";
import { TimeClockClient } from "@/components/staff/TimeClockClient";

export default function TimeClockPage() {
  return (
    <div>
      <PageHeader
        title="Time Clock"
        description="Geo-verified clock in and break attestation at clock out"
      />
      <TimeClockClient />
    </div>
  );
}
