"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui";
import { PhotoUploader } from "@/components/photos/PhotoUploader";
import { PhotoGallery } from "@/components/insights/InsightPanel";
import { PHOTO_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

interface Photo {
  id: string;
  url: string;
  title: string | null;
  category: string;
  aiAnalysis: string | null;
  createdAt: string;
}

export default function PhotosPage() {
  const { can } = useAuth();
  const canViewReceipts = can("view_receipts");
  const visibleCategories = PHOTO_CATEGORIES.filter(
    (cat) => canViewReceipts || cat.value !== "RECEIPT"
  );

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const fetchPhotos = useCallback(async () => {
    const res = await fetch("/api/photos");
    const data = await res.json();
    setPhotos(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const categoryCounts = visibleCategories.map((cat) => ({
    ...cat,
    count: photos.filter((p) => p.category === cat.value).length,
  }));

  return (
    <div>
      <PageHeader
        title="Photo Library"
        description="Capture and organize photos by category — menu, inventory, receipts, and more"
      />

      <PhotoUploader
        onUploadComplete={fetchPhotos}
        excludeCategories={canViewReceipts ? [] : ["RECEIPT"]}
      />

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Browse by Category</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter(undefined)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              !categoryFilter
                ? "bg-orange-500 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            All ({photos.length})
          </button>
          {categoryCounts.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategoryFilter(cat.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                categoryFilter === cat.value
                  ? "bg-orange-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading photos...</p>
        ) : (
          <PhotoGallery photos={photos} categoryFilter={categoryFilter} />
        )}
      </div>
    </div>
  );
}
