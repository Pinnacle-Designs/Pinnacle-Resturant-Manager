import Link from "next/link";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";

interface PlanUpgradeBannerProps {
  title: string;
  description: string;
  requiredPlan?: PlanId;
  className?: string;
}

export function PlanUpgradeBanner({
  title,
  description,
  requiredPlan,
  className = "",
}: PlanUpgradeBannerProps) {
  return (
    <div
      className={`rounded-xl border border-orange-200 bg-orange-50 p-4 ${className}`}
    >
      <p className="text-sm font-medium text-orange-900">{title}</p>
      <p className="mt-1 text-sm text-orange-800">{description}</p>
      {requiredPlan && (
        <p className="mt-1 text-xs text-orange-700">
          Included on {PLAN_BY_ID[requiredPlan].name} (${PLAN_BY_ID[requiredPlan].price}/mo)
        </p>
      )}
      <Link
        href="/account?tab=billing"
        className="mt-3 inline-flex text-sm font-medium text-orange-600 hover:text-orange-500"
      >
        View plans & billing →
      </Link>
    </div>
  );
}
