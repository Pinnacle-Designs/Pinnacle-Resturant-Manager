"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/lib/constants";
import { EmbedNavLink } from "@/components/layout/useEmbedHref";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface SidebarNavGroupsProps {
  navItems: readonly NavItem[];
  icons: Record<string, React.ComponentType<{ className?: string }>>;
}

function groupContainingPath(pathname: string): string | null {
  for (const group of NAV_GROUPS) {
    if (group.hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`))) {
      return group.id;
    }
  }
  return NAV_GROUPS[0]?.id ?? null;
}

export function SidebarNavGroups({ navItems, icons }: SidebarNavGroupsProps) {
  const pathname = usePathname();
  const navByHref = useMemo(() => new Map(navItems.map((i) => [i.href, i])), [navItems]);

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.hrefs
          .map((href) => navByHref.get(href))
          .filter((item): item is NavItem => item != null),
      })).filter((group) => group.items.length > 0),
    [navByHref]
  );

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = groupContainingPath(pathname);
    return new Set(active ? [active] : groups.slice(0, 1).map((g) => g.id));
  });

  useEffect(() => {
    const active = groupContainingPath(pathname);
    if (active) {
      setOpenGroups((prev) => new Set([...prev, active]));
    }
  }, [pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const open = openGroups.has(group.id);
        const hasActive = group.items.some((item) => pathname === item.href);

        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={open}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                hasActive ? "text-orange-300" : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
              )}
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                  open ? "rotate-0" : "-rotate-90"
                )}
              />
              <span className="truncate">{group.label}</span>
            </button>
            {open && (
              <div className="ml-1 mt-0.5 space-y-0.5 border-l border-slate-700 pl-2">
                {group.items.map((item) => {
                  const Icon = icons[item.icon] ?? ClipboardList;
                  const isActive = pathname === item.href;
                  return (
                    <EmbedNavLink
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-orange-500 text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </EmbedNavLink>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
