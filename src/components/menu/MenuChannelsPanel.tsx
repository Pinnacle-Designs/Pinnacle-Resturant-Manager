"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Globe,
  RefreshCw,
  Smartphone,
  Store,
  Truck,
} from "lucide-react";
import { Button, Badge } from "@/components/ui";
import {
  CollapsibleGroup,
  CollapsibleGroupControls,
  CollapsibleSection,
} from "@/components/ui/Collapsible";
import { Input } from "@/components/ui/form";
import { apiPatch, apiPost } from "@/lib/api";
import { applyChannelMarkup, type MenuChannelId } from "@/lib/menu/channels";
import { cn, formatCurrency } from "@/lib/utils";

interface ChannelMeta {
  id: MenuChannelId;
  label: string;
  shortLabel: string;
  description: string;
  defaultMarkupPct: number;
  internal: boolean;
  delivery: boolean;
}

export interface MenuChannelConfigRow {
  id: string;
  channel: MenuChannelId;
  enabled: boolean;
  priceMarkupPct: number;
  externalStoreId: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  meta: ChannelMeta;
}

interface MenuChannelsPanelProps {
  initialChannels: MenuChannelConfigRow[];
  initialRevision: number;
  sampleBasePrice: number;
  locationId: string;
}

const CHANNEL_ICONS: Record<MenuChannelId, typeof Store> = {
  POS: Store,
  TABLESIDE: Smartphone,
  WEBSITE: Globe,
  DOORDASH: Truck,
  UBER_EATS: Truck,
  GRUBHUB: Truck,
};

function formatSyncedAt(iso: string | null) {
  if (!iso) return "Never synced";
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

export function MenuChannelsPanel({
  initialChannels,
  initialRevision,
  sampleBasePrice,
  locationId,
}: MenuChannelsPanelProps) {
  const [channels, setChannels] = useState(initialChannels);
  const [revision, setRevision] = useState(initialRevision);
  const [syncing, setSyncing] = useState(false);
  const [savingChannel, setSavingChannel] = useState<MenuChannelId | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const previewPrice = useMemo(
    () => (sampleBasePrice > 0 ? sampleBasePrice : 12.99),
    [sampleBasePrice]
  );

  const refresh = useCallback(async () => {
    const res = await fetch("/api/menu/channels");
    if (!res.ok) return;
    const data = await res.json();
    setChannels(data.channels);
    setRevision(data.menuRevision);
  }, []);

  const updateChannel = async (
    channel: MenuChannelId,
    patch: { enabled?: boolean; priceMarkupPct?: number }
  ) => {
    setSavingChannel(channel);
    setMessage(null);
    try {
      const updated = await apiPatch<MenuChannelConfigRow>("/api/menu/channels", {
        channel,
        ...patch,
        syncAfterUpdate: true,
      });
      setChannels((prev) => prev.map((c) => (c.channel === channel ? updated : c)));
      await refresh();
      setMessage(`Updated ${updated.meta.shortLabel} and pushed menu.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update channel");
    } finally {
      setSavingChannel(null);
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const data = await apiPost<{ results: { channel: string; ok: boolean; message: string }[] }>(
        "/api/menu/channels/sync",
        {}
      );
      await refresh();
      const ok = data.results.filter((r) => r.ok).length;
      setMessage(`Synced ${ok} of ${data.results.length} channels.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Menu revision <strong>{revision}</strong> · in-app channels update instantly via sync
        </p>
        <Button onClick={syncAll} disabled={syncing} variant="secondary" size="sm">
          <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync all channels"}
        </Button>
      </div>

      {message && (
        <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p>
      )}

      <CollapsibleGroup defaultExpanded="first" expandKey="menu-channels">
        <CollapsibleGroupControls className="mb-3" />
        <div className="space-y-3">
          {channels.map((cfg, index) => {
            const Icon = CHANNEL_ICONS[cfg.channel];
            const channelPrice = applyChannelMarkup(previewPrice, cfg.priceMarkupPct);
            const busy = savingChannel === cfg.channel;

            return (
              <CollapsibleSection
                key={cfg.channel}
                id={`channel-${cfg.channel}`}
                title={cfg.meta.label}
                description={cfg.meta.description}
                defaultOpen={index === 0}
                variant="plain"
                bodyClassName="!pt-2"
                badge={
                  <Badge
                    className={
                      cfg.enabled ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                    }
                  >
                    {cfg.enabled ? "On" : "Off"}
                  </Badge>
                }
              >
                <div
                  className={cn(
                    "rounded-xl border p-4 transition-colors",
                    cfg.enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-75"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={cfg.enabled}
                          disabled={busy}
                          onChange={(e) => updateChannel(cfg.channel, { enabled: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                        Channel enabled
                      </label>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Sample item</p>
                      <p className="font-semibold text-orange-600">{formatCurrency(channelPrice)}</p>
                      {cfg.priceMarkupPct > 0 && (
                        <p className="text-[10px] text-slate-400">
                          base {formatCurrency(previewPrice)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Price markup %
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={cfg.priceMarkupPct}
                          disabled={busy || !cfg.enabled}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!Number.isNaN(val)) {
                              setChannels((prev) =>
                                prev.map((c) =>
                                  c.channel === cfg.channel ? { ...c, priceMarkupPct: val } : c
                                )
                              );
                            }
                          }}
                          onBlur={(e) => {
                            const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                            if (val !== cfg.priceMarkupPct) {
                              updateChannel(cfg.channel, { priceMarkupPct: val });
                            }
                          }}
                          className="h-9 w-20"
                        />
                        <span className="text-xs text-slate-500">on base price</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {cfg.meta.internal ? (
                      <Badge className="bg-blue-50 text-blue-700">Instant (revision)</Badge>
                    ) : cfg.meta.delivery ? (
                      <Badge className="bg-amber-50 text-amber-800">Delivery API</Badge>
                    ) : (
                      <Badge className="bg-violet-50 text-violet-700">Website embed</Badge>
                    )}
                    {cfg.lastSyncStatus === "success" && (
                      <Badge className="bg-green-50 text-green-700">Synced</Badge>
                    )}
                    <span className="text-[11px] text-slate-400">{formatSyncedAt(cfg.lastSyncedAt)}</span>
                  </div>
                  {cfg.lastSyncMessage && (
                    <p className="mt-2 text-[11px] leading-snug text-slate-500">{cfg.lastSyncMessage}</p>
                  )}
                  {cfg.channel === "TABLESIDE" && cfg.enabled && (
                    <a
                      href={`/tableside?locationId=${encodeURIComponent(locationId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-xs font-medium text-orange-600 hover:underline"
                    >
                      Preview QR tableside menu →
                    </a>
                  )}
                </div>
              </CollapsibleSection>
            );
          })}
        </div>
      </CollapsibleGroup>
    </div>
  );
}
