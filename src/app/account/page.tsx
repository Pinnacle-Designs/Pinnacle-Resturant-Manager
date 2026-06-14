import { Suspense } from "react";
import { AccountClient } from "@/components/account/AccountClient";

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-slate-500">Loading…</div>}>
      <AccountClient />
    </Suspense>
  );
}
