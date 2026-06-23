"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEmbedRouter } from "@/components/layout/useEmbedHref";
import { matchesSearchQuery } from "@/lib/search/text-match";

export function usePageSearch(param = "q") {
  const { replace: embedReplace } = useEmbedRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get(param) ?? "";

  const [query, setQueryState] = useState(urlQuery);

  useEffect(() => {
    setQueryState(urlQuery);
  }, [urlQuery]);

  const setQuery = useCallback(
    (next: string) => {
      setQueryState(next);
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = next.trim();
      if (trimmed) params.set(param, trimmed);
      else params.delete(param);
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      embedReplace(href);
    },
    [param, pathname, embedReplace, searchParams]
  );

  const clearQuery = useCallback(() => setQuery(""), [setQuery]);

  const matches = useCallback(
    (...fields: (string | null | undefined)[]) => matchesSearchQuery(query, ...fields),
    [query]
  );

  return { query, setQuery, clearQuery, matches, hasQuery: query.trim().length > 0 };
}
