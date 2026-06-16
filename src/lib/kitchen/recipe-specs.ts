import { prisma } from "@/lib/prisma";
import { formatPortionLabel, roundKitchenQty, scaleRecipeQty } from "./portion";
import { getPlatingSpec } from "./plating-catalog";
import type { PrepList } from "./prep-list";

export interface KitchenRecipeLine {
  inventoryItemId: string;
  ingredient: string;
  unit: string;
  perPlateQty: number;
  perPlateLabel: string;
  portionSize: number | null;
  yieldPct: number;
  scaledSellableQty: number;
  scaledRawQty: number;
  scaledLabel: string;
}

export interface KitchenRecipeSpec {
  menuItemId: string;
  name: string;
  category: string;
  description: string | null;
  portionSpec: string;
  platingNotes: string;
  plateware: string | null;
  garnish: string | null;
  forecastPlates: number;
  lines: KitchenRecipeLine[];
}

function buildLines(
  recipeLines: Array<{
    quantity: number;
    inventoryItemId: string;
    inventoryItem: {
      name: string;
      unit: string;
      yieldPct: number;
      portionSize: number | null;
    };
  }>,
  forecastPlates: number
): KitchenRecipeLine[] {
  return recipeLines.map((line) => {
    const yieldPct = line.inventoryItem.yieldPct ?? 100;
    const perPlateQty = line.quantity;
    const scaledSellable = scaleRecipeQty(perPlateQty, forecastPlates);
    const scaledRaw = roundKitchenQty(scaledSellable / (yieldPct / 100));

    return {
      inventoryItemId: line.inventoryItemId,
      ingredient: line.inventoryItem.name,
      unit: line.inventoryItem.unit,
      perPlateQty,
      perPlateLabel: formatPortionLabel(
        perPlateQty,
        line.inventoryItem.unit,
        line.inventoryItem.portionSize
      ),
      portionSize: line.inventoryItem.portionSize,
      yieldPct,
      scaledSellableQty: scaledSellable,
      scaledRawQty: scaledRaw,
      scaledLabel: formatPortionLabel(scaledSellable, line.inventoryItem.unit, line.inventoryItem.portionSize),
    };
  });
}

export async function getKitchenRecipeSpecs(
  locationId: string,
  prepList?: PrepList | null
): Promise<KitchenRecipeSpec[]> {
  const forecastByMenuId = new Map(
    (prepList?.menuItems ?? []).map((m) => [m.menuItemId, m.forecastPlates])
  );

  const menuItems = await prisma.menuItem.findMany({
    where: { locationId, available: true },
    include: {
      recipeLines: {
        include: { inventoryItem: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return menuItems.map((item) => {
    const plating = getPlatingSpec(item.name);
    const forecastPlates = forecastByMenuId.get(item.id) ?? 0;

    return {
      menuItemId: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      portionSpec: plating?.portionSpec ?? "Per recipe build below",
      platingNotes: plating?.platingNotes ?? "Follow standard line presentation.",
      plateware: plating?.plateware ?? null,
      garnish: plating?.garnish ?? null,
      forecastPlates,
      lines: buildLines(item.recipeLines, forecastPlates > 0 ? forecastPlates : 1),
    };
  });
}

/** Rebuild recipe lines when plate count is overridden in the UI. */
export function scaleRecipeSpec(
  spec: KitchenRecipeSpec,
  plates: number
): KitchenRecipeSpec {
  const count = Math.max(0.5, plates);
  return {
    ...spec,
    forecastPlates: roundKitchenQty(count),
    lines: spec.lines.map((line) => {
      const scaledSellable = scaleRecipeQty(line.perPlateQty, count);
      const scaledRaw = roundKitchenQty(scaledSellable / (line.yieldPct / 100));
      return {
        ...line,
        scaledSellableQty: scaledSellable,
        scaledRawQty: scaledRaw,
        scaledLabel: formatPortionLabel(scaledSellable, line.unit, line.portionSize),
      };
    }),
  };
}
