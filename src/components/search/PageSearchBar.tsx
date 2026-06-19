"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

interface PageSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
}

export function PageSearchBar({
  value,
  onChange,
  placeholder = "Search…",
  className,
  onSubmit,
}: PageSearchBarProps) {
  return (
    <form
      className={cn("no-print relative w-full max-w-xl", className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-10 w-full pl-9 pr-9"
        aria-label="Search this page"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
