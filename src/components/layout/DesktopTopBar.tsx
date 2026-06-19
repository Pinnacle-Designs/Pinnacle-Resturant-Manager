"use client";

import { InstallAppButton } from "@/components/pwa/InstallAppButton";

export function DesktopTopBar() {
  return (
    <header className="no-print sticky top-0 z-30 hidden h-12 items-center justify-end border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:flex">
      <InstallAppButton variant="light" />
    </header>
  );
}
