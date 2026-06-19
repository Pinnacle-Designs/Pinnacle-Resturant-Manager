"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportToolbarProps {
  reportId: string;
  className?: string;
}

/** Link to the Reports hub with this report pre-selected for full customization. */
export function ReportToolbar({ reportId, className }: ReportToolbarProps) {
  return (
    <Link
      href={`/reports?report=${reportId}`}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        "bg-orange-50 text-orange-700 hover:bg-orange-100",
        className
      )}
    >
      <Settings2 className="h-4 w-4" />
      Customize report
    </Link>
  );
}
