"use client";

import { MapPin, Pencil, Trash2 } from "lucide-react";
import { Button, Badge, CollapsibleSection, CollapsibleGroup, CollapsibleGroupControls } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import {
  groupInventoryByZone,
  zoneSectionAccent,
  type InventoryZoneSection,
} from "@/lib/inventory/group-by-zone";
import type { InventoryItem } from "@/components/inventory/types";
import type { StorageZoneRow } from "@/components/inventory/StorageZonesPanel";
import { useMemo } from "react";
import { filterBySearchQuery } from "@/lib/search/text-match";
import { usePageSearch } from "@/hooks/usePageSearch";

function InventoryItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
}) {
  const isLow = item.quantity <= item.minQuantity;
  return (
    <tr className={isLow ? "bg-amber-50/80" : ""}>
      <td className="px-4 py-3 font-medium text-slate-900 sm:px-6">{item.name}</td>
      <td className="hidden px-4 py-3 font-mono text-xs text-slate-500 sm:table-cell sm:px-6">
        {item.barcode || "—"}
      </td>
      <td className="px-4 py-3 text-slate-600 sm:px-6">
        {item.quantity} {item.unit}
      </td>
      <td className="hidden px-4 py-3 text-slate-600 md:table-cell sm:px-6">
        {item.minQuantity} {item.unit}
      </td>
      <td className="hidden px-4 py-3 text-slate-600 lg:table-cell sm:px-6">
        {formatCurrency(item.costPerUnit)}
      </td>
      <td className="hidden px-4 py-3 text-slate-600 xl:table-cell sm:px-6">
        {(item.yieldPct ?? 100).toFixed(0)}%
      </td>
      <td className="hidden px-4 py-3 text-slate-600 lg:table-cell sm:px-6">
        {item.supplier || "—"}
      </td>
      <td className="px-4 py-3 sm:px-6">
        <Badge className={isLow ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}>
          {isLow ? "Low" : "OK"}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right sm:px-6">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ZoneSection({
  section,
  onEdit,
  onDelete,
}: {
  section: InventoryZoneSection;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
}) {
  const accent = zoneSectionAccent(section.slug);
  const sectionId = section.zoneId ?? "unassigned";

  return (
    <CollapsibleSection
      id={sectionId}
      title={
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-500" />
          {section.zoneName}
        </span>
      }
      badge={
        <>
          <Badge className="bg-white text-slate-700">{section.items.length} items</Badge>
          {section.lowStockCount > 0 && (
            <Badge className="bg-amber-100 text-amber-900">
              {section.lowStockCount} low stock
            </Badge>
          )}
        </>
      }
      className={`overflow-hidden border-2 shadow-none ${accent}`}
      headerClassName="border-b border-inherit bg-white/60 !py-3"
      bodyClassName="!p-0 !border-0"
    >
      <div className="overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50/80 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2.5 sm:px-6">Item</th>
              <th className="hidden px-4 py-2.5 sm:table-cell sm:px-6">Barcode</th>
              <th className="px-4 py-2.5 sm:px-6">Qty</th>
              <th className="hidden px-4 py-2.5 md:table-cell sm:px-6">Min</th>
              <th className="hidden px-4 py-2.5 lg:table-cell sm:px-6">Cost</th>
              <th className="hidden px-4 py-2.5 xl:table-cell sm:px-6">Yield</th>
              <th className="hidden px-4 py-2.5 lg:table-cell sm:px-6">Supplier</th>
              <th className="px-4 py-2.5 sm:px-6">Status</th>
              <th className="px-4 py-2.5 text-right sm:px-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {section.items.map((item) => (
              <InventoryItemRow
                key={item.id}
                item={item}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}

export function InventoryItemsByZone({
  items,
  zones,
  onEdit,
  onDelete,
}: {
  items: InventoryItem[];
  zones: StorageZoneRow[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
}) {
  const { query } = usePageSearch();
  const filteredItems = useMemo(
    () =>
      filterBySearchQuery(items, query, (item) => [
        item.name,
        item.barcode,
        item.supplier,
        item.unit,
      ]),
    [items, query]
  );
  const sections = useMemo(
    () => groupInventoryByZone(filteredItems, zones),
    [filteredItems, zones]
  );

  if (sections.length === 0 && filteredItems.length > 0) {
    return (
      <p className="text-sm text-slate-600">
        Loading storage zones… refresh if items do not appear grouped.
      </p>
    );
  }

  if (sections.length === 0) return null;

  return (
    <CollapsibleGroup
      defaultExpanded={query.trim() ? "all" : "first"}
      expandKey={query.trim() ? "search" : "browse"}
    >
      <CollapsibleGroupControls className="mb-4" />
      <div className="space-y-4">
        {sections.map((section) => (
          <ZoneSection
            key={section.zoneId ?? "unassigned"}
            section={section}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </CollapsibleGroup>
  );
}
