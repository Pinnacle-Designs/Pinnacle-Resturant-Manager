import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import {
  fuzzyMatchInventoryName,
  identifyBarcodeWithAI,
  lookupOpenFoodFacts,
  normalizeBarcode,
  suggestionFromCatalog,
} from "@/lib/inventory-barcode";
import { getLocationLocaleSettings } from "@/lib/location/server-locale";
import { barcodeAiUnitList } from "@/lib/location/locale";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "manage_inventory");
  if (error) return error;

  const locationId = await getLocationIdFromRequest(request);
  const body = await request.json();
  const barcode = normalizeBarcode(String(body.barcode || ""));
  const imageBase64 =
    typeof body.imageBase64 === "string" ? body.imageBase64.replace(/^data:[^;]+;base64,/, "") : undefined;

  if (!barcode || barcode.length < 4) {
    return NextResponse.json({ error: "Valid barcode required" }, { status: 400 });
  }

  const items = await prisma.inventoryItem.findMany({
    where: { locationId },
    select: { id: true, name: true, barcode: true, quantity: true, unit: true, supplier: true },
  });

  const byBarcode = items.find((i) => i.barcode === barcode);
  if (byBarcode) {
    return NextResponse.json({
      barcode,
      source: "inventory",
      existingItem: byBarcode,
      suggestion: null,
    });
  }

  const catalog = await lookupOpenFoodFacts(barcode);
  let suggestion = catalog ? suggestionFromCatalog(barcode, catalog) : null;
  let source: "catalog" | "ai" = catalog ? "catalog" : "ai";

  if (!suggestion) {
    const locale = await getLocationLocaleSettings(locationId);
    suggestion = await identifyBarcodeWithAI(
      barcode,
      imageBase64,
      items.map((i) => i.name),
      barcodeAiUnitList(locale)
    );
    source = "ai";
  }

  const fuzzy = fuzzyMatchInventoryName(suggestion.name, items);

  return NextResponse.json({
    barcode,
    source,
    existingItem: fuzzy
      ? items.find((i) => i.id === fuzzy.id) ?? null
      : null,
    suggestion,
  });
}
