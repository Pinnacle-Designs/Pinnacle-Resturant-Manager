"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  Loader2,
  Maximize2,
  Radar,
  RefreshCw,
} from "lucide-react";
import { MarketingNav } from "./MarketingNav";
import { DEMO_TOUR_STOPS } from "@/lib/marketing-content";
import { launchDemo } from "@/lib/demo-launch";
import { cn } from "@/lib/utils";

export function DemoPage() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStop, setActiveStop] = useState<(typeof DEMO_TOUR_STOPS)[number]>(DEMO_TOUR_STOPS[0]);
  const [iframeKey, setIframeKey] = useState(0);

  const initDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await launchDemo();
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start demo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void initDemo();
  }, [initDemo]);

  const selectStop = (stop: (typeof DEMO_TOUR_STOPS)[number]) => {
    setActiveStop(stop);
    setIframeKey((k) => k + 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <MarketingNav />

      <div className="border-b border-white/10 bg-slate-900/50 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-orange-400" />
            <div>
              <p className="text-sm font-semibold text-white">Live interactive demo</p>
              <p className="text-xs text-slate-400">
                Logged in as owner · sample data loaded · click modules to explore
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void initDemo()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Reset demo
            </button>
            <Link
              href={activeStop.path}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-400"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Open full screen
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Tour sidebar */}
        <aside className="w-full border-b border-white/10 bg-slate-900 lg:w-72 lg:border-b-0 lg:border-r">
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tour the app
            </p>
            <nav className="mt-3 space-y-1">
              {DEMO_TOUR_STOPS.map((stop) => (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => selectStop(stop)}
                  disabled={!ready}
                  className={cn(
                    "flex w-full flex-col rounded-lg px-3 py-2.5 text-left transition",
                    activeStop.id === stop.id
                      ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40"
                      : "text-slate-300 hover:bg-white/5",
                    !ready && "opacity-50"
                  )}
                >
                  <span className="text-sm font-medium">{stop.label}</span>
                  <span className="text-xs opacity-70">{stop.blurb}</span>
                </button>
              ))}
            </nav>
            <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-medium text-slate-300">Try asking the Command Center:</p>
              <p className="mt-1 text-xs italic text-slate-400">
                &quot;What&apos;s hurting my profit this week?&quot;
              </p>
              <button
                type="button"
                disabled={!ready}
                onClick={() => selectStop(DEMO_TOUR_STOPS.find((s) => s.id === "insights")!)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 disabled:opacity-50"
              >
                Go to Command Center
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <p className="mt-4 text-[10px] text-slate-500">
              Demo: owner@pinnacle.com / demo1234
            </p>
          </div>
        </aside>

        {/* Live app iframe */}
        <div className="relative flex flex-1 flex-col">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90">
              <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
              <p className="mt-4 text-sm text-slate-300">Loading demo restaurant…</p>
              <p className="mt-1 text-xs text-slate-500">Seeding menu, staff, orders & analytics</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
              <p className="text-red-400">{error}</p>
              <Link
                href="/login"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Sign in manually
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          )}
          {ready && (
            <iframe
              key={`${activeStop.path}-${iframeKey}`}
              src={activeStop.path}
              title={`Pinnacle demo — ${activeStop.label}`}
              className="h-[calc(100vh-8rem)] w-full flex-1 bg-white lg:h-[calc(100vh-7rem)]"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
            />
          )}
        </div>
      </div>
    </div>
  );
}
