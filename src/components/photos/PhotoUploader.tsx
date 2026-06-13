"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { PHOTO_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PhotoUploaderProps {
  onUploadComplete?: () => void;
  defaultCategory?: string;
  excludeCategories?: string[];
}

export function PhotoUploader({
  onUploadComplete,
  defaultCategory = "OTHER",
  excludeCategories = [],
}: PhotoUploaderProps) {
  const categories = PHOTO_CATEGORIES.filter(
    (cat) => !excludeCategories.includes(cat.value)
  );
  const initialCategory = categories.some((c) => c.value === defaultCategory)
    ? defaultCategory
    : categories[0]?.value ?? "OTHER";

  const [category, setCategory] = useState(initialCategory);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      if (title) formData.append("title", title);
      if (description) formData.append("description", description);
      formData.append("analyzeWithAI", "true");

      const res = await fetch("/api/photos", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      setFile(null);
      setPreview(null);
      setTitle("");
      setDescription("");
      onUploadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold">Upload Photo</h3>

      {!preview ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-8 transition-colors hover:border-orange-300 hover:bg-orange-50"
          >
            <Camera className="h-8 w-8 text-orange-500" />
            <span className="text-sm font-medium text-slate-700">Take Photo</span>
            <span className="text-xs text-slate-400">Use camera</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-8 transition-colors hover:border-orange-300 hover:bg-orange-50"
          >
            <Upload className="h-8 w-8 text-orange-500" />
            <span className="text-sm font-medium text-slate-700">Upload File</span>
            <span className="text-xs text-slate-400">From device</span>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Image
              src={preview}
              alt="Preview"
              width={400}
              height={300}
              className="mx-auto max-h-64 w-auto rounded-lg object-contain"
              unoptimized
            />
            <button
              type="button"
              onClick={clearPreview}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    category === cat.value
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fresh salmon delivery"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Notes (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context..."
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading & analyzing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload & Analyze with AI
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
