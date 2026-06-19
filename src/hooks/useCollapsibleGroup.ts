"use client";

import { createContext, useContext } from "react";

export type CollapsibleDefaultExpanded = "all" | "first" | "none" | string[];

export interface CollapsibleGroupContextValue {
  register: (id: string) => void;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  setOpen: (id: string, open: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  sectionCount: number;
}

export const CollapsibleGroupContext = createContext<CollapsibleGroupContextValue | null>(null);

export function useCollapsibleGroupOptional() {
  return useContext(CollapsibleGroupContext);
}

export function useCollapsibleGroup() {
  const ctx = useContext(CollapsibleGroupContext);
  if (!ctx) {
    throw new Error("useCollapsibleGroup must be used within CollapsibleGroup");
  }
  return ctx;
}

export function defaultOpenSet(ids: string[], mode: CollapsibleDefaultExpanded): Set<string> {
  if (ids.length === 0) return new Set();
  if (mode === "all") return new Set(ids);
  if (mode === "none") return new Set();
  if (mode === "first") return new Set([ids[0]!]);
  return new Set(mode.filter((id) => ids.includes(id)));
}
