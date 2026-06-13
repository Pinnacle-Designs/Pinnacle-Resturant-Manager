"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Camera,
  Utensils,
  Package,
  Users,
  ClipboardList,
  DollarSign,
  Brain,
  LayoutGrid,
  Share2,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/components/auth/AuthProvider";
import { filterNavForRole } from "@/lib/permissions";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "layout-dashboard": LayoutDashboard,
  camera: Camera,
  utensils: Utensils,
  package: Package,
  users: Users,
  "layout-grid": LayoutGrid,
  "clipboard-list": ClipboardList,
  "dollar-sign": DollarSign,
  brain: Brain,
  "share-2": Share2,
  "bar-chart-3": BarChart3,
};

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = user ? filterNavForRole(user.role, NAV_ITEMS) : NAV_ITEMS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white md:hidden">
      <div className="flex justify-around py-2">
        {navItems.slice(0, 5).map((item) => {
          const Icon = ICONS[item.icon];
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 text-xs",
                isActive ? "text-orange-600" : "text-slate-500"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
