export interface StorageZoneRef {
  id: string;
  name: string;
  slug?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minQuantity: number;
  costPerUnit: number;
  portionSize: number | null;
  yieldPct: number;
  supplier: string | null;
  barcode?: string | null;
  storageZoneId?: string | null;
  storageZone?: StorageZoneRef | null;
}
