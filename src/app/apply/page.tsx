import { ApplyClient } from "@/components/hiring/ApplyClient";

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  return <ApplyClient applyCode={params.code?.toUpperCase()} />;
}
