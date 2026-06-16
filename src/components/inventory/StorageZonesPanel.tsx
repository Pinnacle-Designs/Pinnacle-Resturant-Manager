"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, MapPin } from "lucide-react";
import { Button, Badge, EmptyState } from "@/components/ui";
import { Input, FormField, Modal } from "@/components/ui/form";
import { apiDelete, apiPost } from "@/lib/api";
import { DEFAULT_STORAGE_ZONES } from "@/lib/walk-in/storage-zone-constants";

export interface StorageZoneRow {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  _count?: { items: number; routeSteps: number };
}

interface StorageZonesPanelProps {
  onZonesChange?: (zones: StorageZoneRow[]) => void;
}

export function StorageZonesPanel({ onZonesChange }: StorageZonesPanelProps) {
  const [zones, setZones] = useState<StorageZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultSlugs = new Set(DEFAULT_STORAGE_ZONES.map((z) => z.slug));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/storage-zones");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setZones(list);
      onZonesChange?.(list);
    } catch {
      setError("Failed to load storage zones");
    } finally {
      setLoading(false);
    }
  }, [onZonesChange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Zone name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await apiPost<StorageZoneRow>("/api/inventory/storage-zones", {
        name: name.trim(),
      });
      setZones((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      onZonesChange?.([...zones, created]);
      setName("");
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create zone");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (zone: StorageZoneRow) => {
    const itemCount = zone._count?.items ?? 0;
    const msg =
      itemCount > 0
        ? `Delete "${zone.name}"? ${itemCount} inventory item(s) will be unassigned from this zone.`
        : `Delete "${zone.name}"?`;
    if (!confirm(msg)) return;

    try {
      await apiDelete(`/api/inventory/storage-zones/${zone.id}`);
      const next = zones.filter((z) => z.id !== zone.id);
      setZones(next);
      onZonesChange?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete zone");
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading storage zones…</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Organize stock by physical location. Items assigned to a zone appear on that zone&apos;s count route.
        </p>
        <Button onClick={() => { setError(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" />
          Add zone
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {zones.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-12 w-12" />}
          title="No storage zones"
          description="Default zones are created automatically — refresh or add your own."
          action={<Button onClick={load}>Refresh</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-slate-500">Zone</th>
                <th className="px-6 py-3 text-left font-medium text-slate-500">Items</th>
                <th className="px-6 py-3 text-left font-medium text-slate-500">Count route</th>
                <th className="px-6 py-3 text-right font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {zones.map((zone) => (
                <tr key={zone.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{zone.name}</span>
                      {defaultSlugs.has(zone.slug as (typeof DEFAULT_STORAGE_ZONES)[number]["slug"]) && (
                        <Badge className="bg-slate-100 text-slate-600">Default</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{zone._count?.items ?? 0}</td>
                  <td className="px-6 py-4 text-slate-600">{zone._count?.routeSteps ?? 0} steps</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(zone)}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add storage zone">
        <div className="space-y-4">
          <FormField label="Zone name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Prep Cooler, Wine Cellar"
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create zone"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
