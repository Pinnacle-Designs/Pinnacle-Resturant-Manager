"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, Upload, Loader2, Receipt, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { Input, Select, FormField } from "@/components/ui/form";
import { formatCurrency } from "@/lib/utils";

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  receiptUrl: string | null;
}

interface ReceiptData {
  description: string;
  amount: number;
  category: string;
  date: string;
  vendor: string;
  items: string[];
}

interface ReceiptScannerProps {
  onExpenseCreated: (expense: Expense) => void;
}

const EXPENSE_CATEGORIES = [
  "Food & Supplies",
  "Utilities",
  "Maintenance",
  "Labor",
  "Marketing",
  "Equipment",
  "Insurance",
  "Other",
];

export function ReceiptScanner({ onExpenseCreated }: ReceiptScannerProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setReceiptData(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
  };

  const scanReceipt = async () => {
    if (!file) return;
    setScanning(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/receipts/scan", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");

      setReceiptData(data.receipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const saveExpense = async () => {
    if (!receiptData) return;
    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      formData.append("description", receiptData.description);
      formData.append("amount", String(receiptData.amount));
      formData.append("category", receiptData.category);
      formData.append("date", receiptData.date);

      const res = await fetch("/api/receipts/scan", { method: "PUT", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      onExpenseCreated(data.expense);
      setPreview(null);
      setFile(null);
      setReceiptData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const clear = () => {
    setPreview(null);
    setFile(null);
    setReceiptData(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <Receipt className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">Receipt Scanner</h3>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Take a photo of a receipt — AI extracts vendor, amount, and category automatically.
      </p>

      {!preview ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 transition-colors hover:border-green-300 hover:bg-green-50"
          >
            <Camera className="h-6 w-6 text-green-600" />
            <span className="text-sm font-medium">Scan Receipt</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 transition-colors hover:border-green-300 hover:bg-green-50"
          >
            <Upload className="h-6 w-6 text-green-600" />
            <span className="text-sm font-medium">Upload Receipt</span>
          </button>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="relative mx-auto max-w-xs">
            <Image src={preview} alt="Receipt" width={300} height={400} className="rounded-lg object-contain" unoptimized />
          </div>

          {!receiptData ? (
            <Button onClick={scanReceipt} disabled={scanning} className="w-full">
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting data...
                </>
              ) : (
                "Extract Receipt Data"
              )}
            </Button>
          ) : (
            <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Receipt data extracted</span>
              </div>
              <FormField label="Description">
                <Input
                  value={receiptData.description}
                  onChange={(e) => setReceiptData({ ...receiptData, description: e.target.value })}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Amount">
                  <Input
                    type="number"
                    step="0.01"
                    value={receiptData.amount}
                    onChange={(e) => setReceiptData({ ...receiptData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label="Date">
                  <Input
                    type="date"
                    value={receiptData.date}
                    onChange={(e) => setReceiptData({ ...receiptData, date: e.target.value })}
                  />
                </FormField>
              </div>
              <FormField label="Category">
                <Select
                  value={receiptData.category}
                  onChange={(e) => setReceiptData({ ...receiptData, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </FormField>
              {receiptData.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700">Line items detected:</p>
                  <ul className="mt-1 text-xs text-slate-500">
                    {receiptData.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={clear}>Cancel</Button>
                <Button onClick={saveExpense} disabled={saving} className="flex-1">
                  {saving ? "Saving..." : `Save Expense (${formatCurrency(receiptData.amount)})`}
                </Button>
              </div>
            </div>
          )}

          {!receiptData && (
            <Button variant="secondary" onClick={clear} className="w-full">Cancel</Button>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
