import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface BarcodeProductSuggestion {
  name: string;
  brand?: string;
  unit: string;
  supplier?: string;
  packageSize?: string;
  category?: string;
  confidence: "high" | "medium" | "low";
}

export interface OpenFoodFactsProduct {
  name: string;
  brand?: string;
  quantity?: string;
  categories?: string;
}

/** Normalize UPC/EAN to digits only. */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}

export async function lookupOpenFoodFacts(
  barcode: string
): Promise<OpenFoodFactsProduct | null> {
  const code = normalizeBarcode(barcode);
  if (!code) return null;

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        brands?: string;
        quantity?: string;
        categories_tags?: string[];
      };
    };

    if (data.status !== 1 || !data.product?.product_name) return null;

    const categories = data.product.categories_tags?.[0]?.replace(/^en:/, "") ?? undefined;

    return {
      name: data.product.product_name.trim(),
      brand: data.product.brands?.split(",")[0]?.trim(),
      quantity: data.product.quantity?.trim(),
      categories,
    };
  } catch (err) {
    console.error("Open Food Facts lookup failed:", err);
    return null;
  }
}

function unitFromPackageQuantity(quantity?: string): string {
  if (!quantity) return "units";
  const q = quantity.toLowerCase();
  if (/\b(lb|lbs|pound)\b/.test(q)) return "lbs";
  if (/\b(kg|kilogram)\b/.test(q)) return "kg";
  if (/\b(g|gram)\b/.test(q)) return "oz";
  if (/\b(ml|liter|litre|l)\b/.test(q)) return "bottles";
  if (/\boz\b/.test(q)) return "oz";
  return "units";
}

export function suggestionFromCatalog(
  barcode: string,
  catalog: OpenFoodFactsProduct
): BarcodeProductSuggestion {
  const label = catalog.brand
    ? `${catalog.brand} ${catalog.name}`
    : catalog.name;

  return {
    name: label,
    brand: catalog.brand,
    unit: unitFromPackageQuantity(catalog.quantity),
    supplier: catalog.brand,
    packageSize: catalog.quantity,
    category: catalog.categories,
    confidence: "high",
  };
}

export async function identifyBarcodeWithAI(
  barcode: string,
  imageBase64: string | undefined,
  existingItemNames: string[]
): Promise<BarcodeProductSuggestion> {
  const fallback: BarcodeProductSuggestion = {
    name: `Item ${barcode}`,
    unit: "units",
    confidence: "low",
  };

  if (!openai) return fallback;

  const catalogHint = await lookupOpenFoodFacts(barcode);
  if (catalogHint) return suggestionFromCatalog(barcode, catalogHint);

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: imageBase64
          ? [
              {
                type: "text",
                text: `Identify this grocery/restaurant inventory product for barcode ${barcode}. Return JSON: name (product name for kitchen inventory), brand (optional), unit (one of: lbs, oz, kg, units, bottles, cases, heads), supplier (optional), packageSize (optional string), category (optional), confidence (high|medium|low). Existing inventory names for matching context: ${existingItemNames.slice(0, 20).join(", ") || "none"}.`,
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ]
          : `Identify the grocery or restaurant inventory product for barcode ${barcode}. Return JSON: name, brand (optional), unit (lbs|oz|kg|units|bottles|cases|heads), supplier (optional), packageSize (optional), category (optional), confidence (high|medium|low). Existing inventory: ${existingItemNames.slice(0, 20).join(", ") || "none"}.`,
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content) as Partial<BarcodeProductSuggestion>;
    return {
      name: parsed.name?.trim() || fallback.name,
      brand: parsed.brand,
      unit: parsed.unit || "units",
      supplier: parsed.supplier,
      packageSize: parsed.packageSize,
      category: parsed.category,
      confidence: parsed.confidence || "medium",
    };
  } catch (err) {
    console.error("AI barcode identification failed:", err);
    return fallback;
  }
}

export function fuzzyMatchInventoryName(
  suggestionName: string,
  items: Array<{ id: string; name: string; barcode: string | null }>
): { id: string; name: string } | null {
  const needle = suggestionName.toLowerCase().trim();
  if (!needle) return null;

  const exact = items.find((i) => i.name.toLowerCase() === needle);
  if (exact) return { id: exact.id, name: exact.name };

  const contains = items.find(
    (i) =>
      i.name.toLowerCase().includes(needle) || needle.includes(i.name.toLowerCase())
  );
  return contains ? { id: contains.id, name: contains.name } : null;
}
