"use client";

import { Logo } from "@/components/layout/Logo";
import { GlobalSearchTrigger } from "@/components/search/GlobalSearch";

export function MobileHeader() {
  return (
    <header className="no-print sticky top-0 z-40 flex items-center justify-between border-b bg-slate-900 px-4 py-3 md:hidden">
      <Logo priority />
      <GlobalSearchTrigger variant="icon" />
    </header>
  );
}
