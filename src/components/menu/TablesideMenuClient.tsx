"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { useMenuSync } from "@/hooks/useMenuSync";
import {
  CollapsibleGroup,
  CollapsibleGroupControls,
  CollapsibleSection,
} from "@/components/ui/Collapsible";

interface PublishedItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  basePrice: number;
  channelPrice: number;
  markupPct: number;
}

interface PublicMenuPayload {
  locationName: string;
  menuRevision: number;
  markupPct: number;
  channelLabel: string;
  grouped: Record<string, PublishedItem[]>;
}

export function TablesideMenuClient() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get("locationId");
  const [data, setData] = useState<PublicMenuPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ channel: "TABLESIDE" });
      if (locationId) qs.set("locationId", locationId);
      const res = await fetch(`/api/menu/public?${qs}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not load menu");
      }
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load menu");
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
  }, [load]);

  useMenuSync(data?.menuRevision, load, true);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        Loading menu…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-600">{error ?? "Menu unavailable"}</p>
        <p className="mt-2 text-sm text-slate-500">Sign in or scan a valid table QR code.</p>
      </div>
    );
  }

  const categories = Object.entries(data.grouped);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      <header className="border-b border-white/10 px-4 py-8 text-center">
        <p className="text-xs uppercase tracking-widest text-orange-400">Tableside menu</p>
        <h1 className="mt-2 text-2xl font-bold">{data.locationName}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Synced from One Menu · revision {data.menuRevision}
        </p>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        {categories.length === 0 ? (
          <p className="text-center text-slate-400">No items available right now.</p>
        ) : (
          <CollapsibleGroup defaultExpanded="all" expandKey="tableside-menu">
            <CollapsibleGroupControls className="mb-4 [&_button]:text-slate-300" />
            <div className="space-y-3">
              {categories.map(([category, items], index) => (
                <CollapsibleSection
                  key={category}
                  id={`category-${category}`}
                  title={category}
                  defaultOpen={index === 0}
                  variant="plain"
                  className="border-white/10 bg-white/5"
                  headerClassName="[&_span]:text-orange-300 [&_button]:hover:bg-white/5"
                  bodyClassName="border-white/10 !pt-2"
                  badge={
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-normal text-slate-400">
                      {items.length} items
                    </span>
                  }
                >
                  <ul className="space-y-4">
                    {items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-4">
                        <div>
                          <p className="font-medium text-white">{item.name}</p>
                          {item.description && (
                            <p className="mt-0.5 text-sm text-slate-400">{item.description}</p>
                          )}
                        </div>
                        <p className="shrink-0 font-semibold text-orange-400">
                          {formatCurrency(item.channelPrice)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
              ))}
            </div>
          </CollapsibleGroup>
        )}
      </main>

      <footer className="px-4 py-6 text-center text-xs text-slate-500">
        Powered by Pinnacle · prices update when the kitchen updates the menu
      </footer>
    </div>
  );
}
