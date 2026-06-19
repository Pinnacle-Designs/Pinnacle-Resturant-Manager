"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Barcode,
  Camera,
  CheckCircle2,
  Loader2,
  Scale,
  ScanLine,
  Unplug,
} from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { Input, FormField, Modal } from "@/components/ui/form";
import { UnitSelect } from "@/components/inventory/UnitSelect";
import { useLocationLocale } from "@/components/location/LocationLocaleProvider";
import { defaultWeightUnit } from "@/lib/location/measurements";
import { apiPost } from "@/lib/api";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useScaleSerial } from "@/hooks/useScaleSerial";
import type { InventoryItem } from "@/components/inventory/types";

interface ScanSuggestion {
  name: string;
  brand?: string;
  unit: string;
  supplier?: string;
  packageSize?: string;
  confidence: string;
}

interface ScanResult {
  barcode: string;
  source: string;
  existingItem: InventoryItem | null;
  suggestion: ScanSuggestion | null;
}

interface ReceiveResult {
  item: InventoryItem;
  created: boolean;
  added: number;
}

interface InventoryScanModalProps {
  open: boolean;
  onClose: () => void;
  onReceived: (item: InventoryItem, created: boolean) => void;
}

export function InventoryScanModal({ open, onClose, onReceived }: InventoryScanModalProps) {
  const { settings } = useLocationLocale();
  const defaultUnit = defaultWeightUnit(settings);
  const [barcode, setBarcode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState(defaultUnit);
  const [supplier, setSupplier] = useState("");
  const [resolving, setResolving] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scaleAuto, setScaleAuto] = useState(true);
  const [lastScaleAt, setLastScaleAt] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resolveLockRef = useRef("");

  const applyScanResult = useCallback((result: ScanResult) => {
    setScanResult(result);
    const item = result.existingItem;
    const suggestion = result.suggestion;
    setName(item?.name ?? suggestion?.name ?? "");
    setUnit(item?.unit ?? suggestion?.unit ?? defaultUnit);
    setSupplier(item?.supplier ?? suggestion?.supplier ?? suggestion?.brand ?? "");
    if (suggestion?.packageSize) {
      const num = parseFloat(suggestion.packageSize);
      if (Number.isFinite(num) && num > 0) {
        setQuantity((prev) => prev || String(num));
      }
    }
  }, [defaultUnit]);

  const resolveBarcode = useCallback(
    async (code: string, captureFrame = false) => {
      const normalized = code.replace(/\D/g, "");
      if (!normalized || normalized.length < 4) return;
      if (resolveLockRef.current === normalized) return;
      resolveLockRef.current = normalized;

      setBarcode(normalized);
      setResolving(true);
      setError(null);
      setSuccess(null);

      let imageBase64: string | undefined;
      if (captureFrame && videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx && canvas.width > 0) {
          ctx.drawImage(video, 0, 0);
          imageBase64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
        }
      }

      try {
        const result = await apiPost<ScanResult>("/api/inventory/scan", {
          barcode: normalized,
          imageBase64,
        });
        applyScanResult(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not identify product");
      } finally {
        setResolving(false);
      }
    },
    [applyScanResult]
  );

  const {
    videoRef,
    active,
    supported,
    nativeSupported,
    error: cameraError,
    permissionDenied,
    permissionState,
    start,
    stop,
    retry,
  } = useBarcodeScanner((code) => {
    void resolveBarcode(code, true);
  });

  const handleScaleWeight = useCallback(
    (value: number, scaleUnit: string) => {
      if (!scaleAuto) return;
      setQuantity(String(Number(value.toFixed(3))));
      setUnit(scaleUnit);
      setLastScaleAt(Date.now());
    },
    [scaleAuto]
  );

  const { supported: scaleSupported, connected: scaleConnected, error: scaleError, connect, disconnect } =
    useScaleSerial(handleScaleWeight);

  useEffect(() => {
    if (!open) {
      stop();
      void disconnect();
      setBarcode("");
      setScanResult(null);
      setName("");
      setQuantity("");
      setUnit(defaultUnit);
      setSupplier("");
      setError(null);
      setSuccess(null);
      resolveLockRef.current = "";
      return;
    }

    void start();
    return () => stop();
  }, [open, start, stop, disconnect, defaultUnit]);

  const handleManualLookup = () => {
    resolveLockRef.current = "";
    void resolveBarcode(barcode, false);
  };

  const handleReceive = async () => {
    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a valid weight or quantity");
      return;
    }
    if (!scanResult?.existingItem && !name.trim()) {
      setError("Product name is required for new items");
      return;
    }

    setReceiving(true);
    setError(null);
    try {
      const result = await apiPost<ReceiveResult>("/api/inventory/receive", {
        barcode,
        itemId: scanResult?.existingItem?.id,
        name: name.trim(),
        quantity: qty,
        unit,
        supplier: supplier || null,
        createIfMissing: true,
      });
      setSuccess(
        result.created
          ? `Added new item “${result.item.name}” with ${result.added} ${result.item.unit}`
          : `Received +${result.added} ${result.item.unit} — ${result.item.quantity} on hand`
      );
      onReceived(result.item, result.created);
      resolveLockRef.current = "";
      setScanResult(null);
      setBarcode("");
      setName("");
      setQuantity("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receive failed");
    } finally {
      setReceiving(false);
    }
  };

  const sourceLabel =
    scanResult?.source === "inventory"
      ? "Matched your inventory"
      : scanResult?.source === "catalog"
        ? "Identified from product database"
        : scanResult?.source === "ai"
          ? "Identified with AI"
          : null;

  return (
    <Modal open={open} onClose={onClose} title="Scan & receive inventory">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Scan a barcode with your camera, then weigh on a connected scale to auto-fill quantity.
        </p>

        <div className="relative overflow-hidden rounded-xl border bg-slate-950">
          <video
            ref={videoRef}
            className="aspect-video w-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />
          {!active && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 text-slate-300">
              <Camera className="h-8 w-8" />
              <p className="text-sm">Starting camera…</p>
            </div>
          )}
          {!active && cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 px-6 text-center text-slate-200">
              <Camera className="h-8 w-8 text-slate-400" />
              <p className="text-sm">{cameraError}</p>
              {permissionDenied && (
                <div className="space-y-2">
                  <Button type="button" size="sm" onClick={() => void retry()}>
                    Allow camera access
                  </Button>
                  <p className="text-xs text-slate-400">
                    {permissionState === "denied"
                      ? "If the prompt does not appear, open your browser site settings and allow Camera for this page."
                      : "Your browser will ask for camera permission."}
                  </p>
                </div>
              )}
              {!permissionDenied && (
                <Button type="button" size="sm" variant="secondary" onClick={() => void retry()}>
                  Try again
                </Button>
              )}
            </div>
          )}
          {active && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-8">
              <div className="mx-auto h-24 max-w-xs rounded-lg border-2 border-orange-400/80" />
            </div>
          )}
        </div>

        {!nativeSupported && supported && (
          <p className="text-xs text-slate-600">
            Using compatibility scanning in this browser. Hold the barcode steady in the frame.
          </p>
        )}
        {!supported && (
          <p className="text-xs text-amber-700">
            Automatic scanning is not available in this browser — type the barcode below or try Chrome
            on Android/desktop.
          </p>
        )}
        {cameraError && active === false && permissionDenied === false && (
          <p className="text-sm text-red-600">{cameraError}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <FormField label="Barcode" className="min-w-[12rem] flex-1">
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ""))}
              placeholder="Scan or type UPC/EAN"
            />
          </FormField>
          <div className="flex items-end">
            <Button variant="secondary" onClick={handleManualLookup} disabled={resolving || !barcode}>
              {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Barcode className="h-4 w-4" />}
              Look up
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <Scale className="h-4 w-4 text-orange-500" />
              Kitchen scale
            </div>
            <div className="flex flex-wrap gap-2">
              {scaleConnected ? (
                <Button variant="secondary" size="sm" onClick={() => void disconnect()}>
                  <Unplug className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void connect()}
                  disabled={!scaleSupported}
                >
                  <Scale className="h-3.5 w-3.5" />
                  Connect scale
                </Button>
              )}
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={scaleAuto}
                  onChange={(e) => setScaleAuto(e.target.checked)}
                />
                Auto-fill weight
              </label>
            </div>
          </div>
          {!scaleSupported && (
            <p className="mt-2 text-xs text-slate-500">
              USB scale connection requires Chrome or Edge on desktop (Web Serial API).
            </p>
          )}
          {scaleError && <p className="mt-2 text-xs text-red-600">{scaleError}</p>}
          {scaleConnected && (
            <p className="mt-2 text-xs text-green-700">
              Scale connected — place item on scale after scanning.
              {lastScaleAt ? ` Last reading ${new Date(lastScaleAt).toLocaleTimeString()}.` : ""}
            </p>
          )}
        </div>

        {(resolving || scanResult) && (
          <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-4">
            {resolving ? (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                Identifying product…
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <ScanLine className="h-4 w-4 text-orange-600" />
                  <span className="font-semibold text-slate-900">{name || "Unknown product"}</span>
                  {sourceLabel && (
                    <Badge className="bg-white text-slate-700">{sourceLabel}</Badge>
                  )}
                </div>
                {scanResult?.existingItem && (
                  <p className="mt-1 text-xs text-slate-600">
                    Current on hand: {scanResult.existingItem.quantity}{" "}
                    {scanResult.existingItem.unit}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Product name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Supplier">
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </FormField>
          <FormField label="Quantity / weight">
            <Input
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={scaleConnected ? "From scale…" : "Enter amount"}
            />
          </FormField>
          <FormField label="Unit">
            <UnitSelect value={unit} onChange={setUnit} />
          </FormField>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleReceive} disabled={receiving || resolving || !barcode}>
            {receiving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Add to inventory"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
