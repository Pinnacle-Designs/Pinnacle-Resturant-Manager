"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useEmbedRouter } from "@/components/layout/useEmbedHref";
import { clientFetch } from "@/lib/embed-api-client";
import {
  Search,
  Loader2,
  Utensils,
  Package,
  Users,
  BookOpen,
  ClipboardList,
  LayoutGrid,
  Navigation,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseJsonResponse } from "@/lib/fetch-json";
import type { SearchResult } from "@/lib/search/global-search";

interface SearchOverlayContextValue {
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchOverlayContext = createContext<SearchOverlayContextValue | null>(null);

export function useSearchOverlay() {
  const ctx = useContext(SearchOverlayContext);
  if (!ctx) {
    return { openSearch: () => undefined, closeSearch: () => undefined };
  }
  return ctx;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  nav: Navigation,
  menu: Utensils,
  inventory: Package,
  staff: Users,
  log: BookOpen,
  order: ClipboardList,
  table: LayoutGrid,
};

const TYPE_LABELS: Record<string, string> = {
  nav: "Pages",
  menu: "Menu",
  inventory: "Inventory",
  staff: "Staff",
  log: "Log book",
  order: "Orders",
  table: "Tables",
};

function groupResults(results: SearchResult[]) {
  const groups = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = groups.get(r.type) ?? [];
    list.push(r);
    groups.set(r.type, list);
  }
  return groups;
}

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const { push: embedPush } = useEmbedRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSearch = useCallback(() => {
    setOpen(true);
    setQuery("");
    setResults([]);
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        if (!open) {
          setQuery("");
          setResults([]);
        }
      }
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSearch, open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        params.set("limit", "24");
        const res = await clientFetch(`/api/search?${params}`);
        const data = await parseJsonResponse<{ results: SearchResult[] }>(res);
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, query.trim() ? 200 : 0);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query]);

  const navigate = (href: string) => {
    closeSearch();
    embedPush(href);
  };

  const grouped = groupResults(results);

  return (
    <SearchOverlayContext.Provider value={{ openSearch, closeSearch }}>
      {children}
      {open && (
        <div className="no-print fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12vh]">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close search"
            onClick={closeSearch}
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Search className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, menu, inventory, staff…"
                className="flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
                aria-label="Global search"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              <button
                type="button"
                onClick={closeSearch}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
              {results.length === 0 && !loading && (
                <p className="px-3 py-6 text-center text-sm text-slate-500">
                  {query.trim()
                    ? "No results — try another term"
                    : "Type to search or browse pages below"}
                </p>
              )}
              {Array.from(grouped.entries()).map(([type, items]) => {
                const Icon = TYPE_ICONS[type] ?? Search;
                return (
                  <div key={type} className="mb-2">
                    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {TYPE_LABELS[type] ?? type}
                    </p>
                    <ul>
                      {items.map((item) => (
                        <li key={`${item.type}-${item.id}`}>
                          <button
                            type="button"
                            onClick={() => navigate(item.href)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"
                          >
                            <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-slate-900">{item.label}</p>
                              {item.meta && (
                                <p className="truncate text-xs text-slate-500">{item.meta}</p>
                              )}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
              <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">Ctrl</kbd>+
              <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">K</kbd> to toggle
            </div>
          </div>
        </div>
      )}
    </SearchOverlayContext.Provider>
  );
}

export function GlobalSearchTrigger({
  className,
  variant = "button",
}: {
  className?: string;
  variant?: "button" | "icon";
}) {
  const { openSearch } = useSearchOverlay();

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={openSearch}
        className={cn(
          "rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white",
          className
        )}
        aria-label="Search (Ctrl+K)"
      >
        <Search className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openSearch}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200",
        className
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-left">Search…</span>
      <kbd className="hidden rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline">
        Ctrl K
      </kbd>
    </button>
  );
}
