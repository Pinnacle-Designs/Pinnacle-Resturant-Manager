"use client";

import { Logo } from "@/components/layout/Logo";
import { GlobalSearchTrigger } from "@/components/search/GlobalSearch";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";

export function MobileHeader() {
  return (
    <header className="no-print sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-slate-900 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 md:hidden">
      <Logo priority />
      <div className="flex items-center gap-2">
        <InstallAppButton variant="dark" />
        <GlobalSearchTrigger variant="icon" />
      </div>
    </header>
  );
}
