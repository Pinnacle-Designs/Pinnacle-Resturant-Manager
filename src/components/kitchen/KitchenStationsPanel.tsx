"use client";

import { useEffect, useState } from "react";
import { Monitor, Printer } from "lucide-react";
import { Badge } from "@/components/ui";
import {
  CollapsibleGroup,
  CollapsibleGroupControls,
  CollapsibleSection,
} from "@/components/ui/Collapsible";
import type { KitchenStationDto } from "@/lib/kitchen/stations";

export function KitchenStationsPanel() {
  const [stations, setStations] = useState<KitchenStationDto[]>([]);

  useEffect(() => {
    fetch("/api/kitchen/stations")
      .then((r) => r.json())
      .then(setStations)
      .catch(() => {});
  }, []);

  if (!stations.length) {
    return <p className="text-sm text-slate-500">No kitchen stations configured yet.</p>;
  }

  return (
    <CollapsibleGroup defaultExpanded="all" expandKey="kitchen-stations">
      <CollapsibleGroupControls className="mb-3" />
      <div className="space-y-2">
        {stations.map((s) => (
          <CollapsibleSection
            key={s.id}
            id={`station-${s.id}`}
            title={s.name}
            variant="plain"
            defaultOpen
            bodyClassName="!pt-2"
            badge={
              <Badge className="bg-white text-[10px] text-slate-600">
                {s.outputKind === "PRINTER" ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Printer className="h-3 w-3" /> Printer
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5">
                    <Monitor className="h-3 w-3" /> KDS
                  </span>
                )}
              </Badge>
            }
          >
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: s.color ?? "#ea580c" }}
              />
              <span>
                Routes menu items and combo splits to this{" "}
                {s.outputKind === "PRINTER" ? "bar printer" : "KDS screen"}.
              </span>
            </div>
          </CollapsibleSection>
        ))}
      </div>
    </CollapsibleGroup>
  );
}
