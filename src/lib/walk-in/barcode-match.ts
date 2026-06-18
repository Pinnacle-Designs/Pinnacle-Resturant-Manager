/** Match a scanned code against inventory barcodes (internal codes + UPC/EAN). */
export function findItemByBarcode<T extends { barcode: string | null }>(
  items: T[],
  rawCode: string
): T | undefined {
  const raw = rawCode.trim();
  if (!raw) return undefined;

  const upper = raw.toUpperCase();
  const digits = raw.replace(/\D/g, "");

  return items.find((item) => {
    if (!item.barcode) return false;
    const stored = item.barcode.trim();
    const storedUpper = stored.toUpperCase();
    if (stored === raw || storedUpper === upper) return true;
    if (digits.length >= 4 && stored.replace(/\D/g, "") === digits) return true;
    return false;
  });
}
