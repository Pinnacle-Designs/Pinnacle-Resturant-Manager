import type { ReportResult } from "@/lib/reports/types";

export function formatCellValue(
  value: string | number | null | undefined,
  type: string
): string {
  if (value == null || value === "") return "—";
  if (type === "currency") {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    return Number.isFinite(n)
      ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
      : String(value);
  }
  if (type === "percent") {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    return Number.isFinite(n) ? `${n.toFixed(1)}%` : String(value);
  }
  if (type === "number") {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n.toLocaleString() : String(value);
  }
  return String(value);
}

export function reportToCsv(result: ReportResult): string {
  const header = result.columns.map((c) => escapeCsv(c.label)).join(",");
  const lines = result.rows.map((row) =>
    result.columns
      .map((c) => escapeCsv(formatCellValue(row[c.id], c.type)))
      .join(",")
  );
  return [header, ...lines].join("\n");
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadReportCsv(result: ReportResult) {
  const slug = result.reportId.replace(/[^a-z0-9]+/gi, "-");
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(reportToCsv(result), `pinnacle-${slug}-${date}.csv`, "text/csv;charset=utf-8");
}

export function downloadReportJson(result: ReportResult) {
  const slug = result.reportId.replace(/[^a-z0-9]+/gi, "-");
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(JSON.stringify(result, null, 2), `pinnacle-${slug}-${date}.json`, "application/json");
}

export function printCustomReport(result: ReportResult) {
  const stamp = document.getElementById("print-report-stamp");
  if (stamp) {
    stamp.textContent = `Printed ${new Date().toLocaleString()}`;
  }

  const prevTitle = document.title;
  document.title = `${result.title} — Pinnacle`;
  window.print();

  const cleanup = () => {
    document.title = prevTitle;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
}
