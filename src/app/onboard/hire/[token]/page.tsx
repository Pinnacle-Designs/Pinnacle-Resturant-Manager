import { HireOnboardingClient } from "@/components/hiring/HireOnboardingClient";

export default async function HireOnboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <HireOnboardingClient token={token} />;
}
