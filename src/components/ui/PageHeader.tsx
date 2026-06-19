"use client";

import { PrintButton } from "@/components/ui/PrintButton";
import { ReportToolbar } from "@/components/reports/ReportToolbar";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Show print report button (default: true) */
  showPrint?: boolean;
  /** Pre-select this report in the Reports customizer */
  reportId?: string;
}

export function PageHeader({ title, description, children, showPrint = true, reportId }: PageHeaderProps) {
  return (
    <div className="page-header mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {(showPrint || children) && (
        <div className="no-print flex flex-wrap items-center gap-2">
          {showPrint && <PrintButton reportTitle={title} />}
          {reportId && <ReportToolbar reportId={reportId} />}
          {children}
        </div>
      )}
    </div>
  );
}
