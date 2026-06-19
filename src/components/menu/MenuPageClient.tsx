"use client";

import Link from "next/link";
import { PageSectionShell, PageSection } from "@/components/layout/PageSections";
import { MenuEngineeringPanel } from "@/components/menu/MenuEngineeringPanel";
import { MenuChannelsPanel } from "@/components/menu/MenuChannelsPanel";
import { KitchenStationsPanel } from "@/components/kitchen/KitchenStationsPanel";
import { MenuClient } from "@/components/menu/MenuClient";
import { ModifierSetsClient } from "@/components/pos/ModifierSetsClient";
import type { MenuEngineeringSnapshot } from "@/lib/menu/engineering";
import type { MenuEngineeringRow } from "@/lib/menu/engineering";
import type { MenuChannelConfigRow } from "@/components/menu/MenuChannelsPanel";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  salesCategory?: string;
  recipeCost?: number;
  available: boolean;
  kitchenStationId?: string | null;
  defaultCourse?: string;
  isCombo?: boolean;
}

interface KitchenStationOption {
  id: string;
  name: string;
}

interface InventoryOption {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
}

interface MenuPageClientProps {
  engineering: MenuEngineeringSnapshot;
  engineeringByItemId: Record<string, MenuEngineeringRow>;
  channels: MenuChannelConfigRow[];
  menuRevision: number;
  sampleBasePrice: number;
  locationId: string;
  items: MenuItem[];
  stations: KitchenStationOption[];
  inventory: InventoryOption[];
}

export function MenuPageClient({
  engineering,
  engineeringByItemId,
  channels,
  menuRevision,
  sampleBasePrice,
  locationId,
  items,
  stations,
  inventory,
}: MenuPageClientProps) {
  return (
    <PageSectionShell pageId="menu" defaultExpanded="first">
      <PageSection
        id="menu-engineering"
        title="Menu engineering"
        description={`Last ${engineering.periodDays} days — popularity vs profit margin. Treat the menu as a revenue asset.`}
        defaultOpen
        headerActions={
          <Link href="/analytics" className="text-sm font-medium text-orange-600 hover:underline">
            Full analytics →
          </Link>
        }
      >
        <MenuEngineeringPanel data={engineering} />
      </PageSection>

      <PageSection
        id="menu-channels"
        title="One Menu — all channels"
        description="Edit prices once. Changes propagate to POS, QR tableside, website, and delivery apps."
      >
        <MenuChannelsPanel
          initialChannels={channels}
          initialRevision={menuRevision}
          sampleBasePrice={sampleBasePrice}
          locationId={locationId}
        />
      </PageSection>

      <PageSection
        id="menu-kitchen-routing"
        title="Kitchen routing"
        description="Menu items route to stations automatically. Combos split to multiple KDS screens or bar printers."
      >
        <KitchenStationsPanel />
      </PageSection>

      <PageSection
        id="menu-items"
        title="Menu items"
        description="POS categories, sales categories, recipe costing, and availability."
      >
        <MenuClient
          initialItems={items}
          stations={stations}
          engineeringByItemId={engineeringByItemId}
          inventory={inventory}
        />
      </PageSection>

      <PageSection
        id="menu-modifiers"
        title="Smart modifier sets"
        description="Category-wide groups and item-specific conversational prompts on POS."
      >
        <ModifierSetsClient menuItems={items} embedded />
      </PageSection>
    </PageSectionShell>
  );
}
