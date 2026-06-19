"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { getPageSearchConfig } from "@/lib/search/page-registry";
import { usePageSearch } from "@/hooks/usePageSearch";
import { PageSearchBar } from "@/components/search/PageSearchBar";
import { CollapsibleSection } from "@/components/ui/Collapsible";
import { cn } from "@/lib/utils";

/** Collapsible per-page search — shown on all app routes except those with custom search. */
export function PageSearchStrip() {
  const pathname = usePathname();
  const config = getPageSearchConfig(pathname);
  const { query, setQuery } = usePageSearch();
  const [defaultOpen, setDefaultOpen] = useState(false);

  useEffect(() => {
    if (query.trim()) setDefaultOpen(true);
  }, [query]);

  if (!config) return null;

  const hasQuery = query.trim().length > 0;

  return (
    <div className="no-print mb-4">
      <CollapsibleSection
        title="Search this page"
        description={hasQuery ? `Filtering by “${query.trim()}”` : config.placeholder}
        defaultOpen={defaultOpen || hasQuery}
        variant="plain"
        badge={
          hasQuery ? (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
              Active
            </span>
          ) : (
            <Search className={cn("h-4 w-4 text-slate-400")} />
          )
        }
        bodyClassName="!pt-0"
      >
        <PageSearchBar value={query} onChange={setQuery} placeholder={config.placeholder} />
      </CollapsibleSection>
    </div>
  );
}
