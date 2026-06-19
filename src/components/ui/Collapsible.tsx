"use client";

import { useEffect, useId, useState, useCallback, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import {
  CollapsibleGroupContext,
  defaultOpenSet,
  useCollapsibleGroupOptional,
  type CollapsibleDefaultExpanded,
} from "@/hooks/useCollapsibleGroup";

export type { CollapsibleDefaultExpanded };

export function CollapsibleGroup({
  children,
  defaultExpanded = "first",
  expandKey,
}: {
  children: React.ReactNode;
  defaultExpanded?: CollapsibleDefaultExpanded;
  expandKey?: string;
}) {
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const register = useCallback((id: string) => {
    setRegisteredIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  useEffect(() => {
    if (registeredIds.length === 0) return;
    setOpenIds(defaultOpenSet(registeredIds, defaultExpanded));
    setInitialized(true);
  }, [registeredIds.join("|"), defaultExpanded, expandKey]);

  const isOpen = useCallback(
    (id: string) => (initialized ? openIds.has(id) : defaultExpanded === "all"),
    [openIds, initialized, defaultExpanded]
  );

  const toggle = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setOpen = useCallback((id: string, open: boolean) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setOpenIds(new Set(registeredIds));
  }, [registeredIds]);

  const collapseAll = useCallback(() => {
    setOpenIds(new Set());
  }, []);

  const value = useMemo(
    () => ({
      register,
      isOpen,
      toggle,
      setOpen,
      expandAll,
      collapseAll,
      sectionCount: registeredIds.length,
    }),
    [register, isOpen, toggle, setOpen, expandAll, collapseAll, registeredIds.length]
  );

  return (
    <CollapsibleGroupContext.Provider value={value}>{children}</CollapsibleGroupContext.Provider>
  );
}

interface CollapsibleSectionProps {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  variant?: "default" | "card" | "plain";
}

export function CollapsibleSection({
  id: idProp,
  title,
  description,
  badge,
  defaultOpen = true,
  className,
  headerClassName,
  bodyClassName,
  headerActions,
  children,
  variant = "default",
}: CollapsibleSectionProps) {
  const autoId = useId();
  const sectionId = idProp ?? autoId;
  const group = useCollapsibleGroupOptional();
  const [localOpen, setLocalOpen] = useState(defaultOpen);

  useEffect(() => {
    group?.register(sectionId);
  }, [group, sectionId]);

  const open = group ? group.isOpen(sectionId) : localOpen;
  const toggle = () => {
    if (group) group.toggle(sectionId);
    else setLocalOpen((v) => !v);
  };

  const variants = {
    default: "rounded-xl border border-slate-200 bg-white shadow-sm",
    card: "card !p-0 overflow-hidden",
    plain: "rounded-lg border border-slate-100 bg-slate-50/50",
  };

  return (
    <section className={cn(variants[variant], className)}>
      <div
        className={cn(
          "flex items-start gap-2",
          variant === "plain" ? "px-3 py-2" : "px-4 py-3 sm:px-5",
          headerClassName
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left transition-colors hover:bg-slate-50/80 -mx-1 px-1 py-0.5"
        >
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
              open ? "rotate-0" : "-rotate-90"
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{title}</span>
              {badge}
            </div>
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
        </button>
        {headerActions && (
          <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {headerActions}
          </div>
        )}
      </div>
      {open && (
        <div
          className={cn(
            "border-t border-slate-100",
            variant === "plain" ? "px-3 pb-3 pt-2" : "px-4 pb-4 pt-3 sm:px-5",
            bodyClassName
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}

export function CollapsibleGroupControls({ className }: { className?: string }) {
  const group = useCollapsibleGroupOptional();
  if (!group || group.sectionCount < 2) return null;

  return (
    <div className={cn("no-print flex flex-wrap items-center justify-end gap-2", className)}>
      <Button type="button" variant="ghost" size="sm" onClick={group.expandAll}>
        Expand all
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={group.collapseAll}>
        Collapse all
      </Button>
    </div>
  );
}
