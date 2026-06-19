import { getReportDefinition } from "@/lib/reports/registry";
import { fetchReportRows } from "@/lib/reports/fetch-data";
import type {
  ReportConfig,
  ReportFilters,
  ReportResult,
  ReportRow,
} from "@/lib/reports/types";

function applyFilters(rows: ReportRow[], filters: ReportFilters): ReportRow[] {
  let result = rows;

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    result = result.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }

  if (filters.category?.trim()) {
    const c = filters.category.trim().toLowerCase();
    result = result.filter((row) =>
      String(row.category ?? "").toLowerCase().includes(c)
    );
  }

  if (filters.vendor?.trim()) {
    const v = filters.vendor.trim().toLowerCase();
    result = result.filter((row) =>
      String(row.vendor ?? row.name ?? "").toLowerCase().includes(v)
    );
  }

  if (filters.flag?.trim()) {
    const f = filters.flag.trim().toUpperCase();
    result = result.filter((row) => String(row.flag ?? "").toUpperCase() === f);
  }

  if (filters.status?.trim()) {
    const s = filters.status.trim().toLowerCase();
    result = result.filter((row) =>
      String(row.status ?? "").toLowerCase().includes(s)
    );
  }

  return result;
}

function applySort(
  rows: ReportRow[],
  sort?: { column: string; direction: "asc" | "desc" }
): ReportRow[] {
  if (!sort?.column) return rows;
  const dir = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[sort.column];
    const bv = b[sort.column];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
  });
}

export async function runReport(
  locationId: string,
  config: ReportConfig,
  locationName?: string
): Promise<ReportResult> {
  const def = getReportDefinition(config.reportId);
  if (!def) throw new Error(`Unknown report: ${config.reportId}`);

  const allRows = await fetchReportRows(locationId, config.reportId, config.filters);
  const filtered = applyFilters(allRows, config.filters);
  const sorted = applySort(filtered, config.sort ?? def.defaultSort);

  const rowLimit = config.rowLimit;
  const rows =
    rowLimit != null && rowLimit > 0 ? sorted.slice(0, rowLimit) : sorted;

  const columnIds =
    config.columns.length > 0
      ? config.columns
      : def.columns.filter((c) => c.defaultVisible !== false).map((c) => c.id);

  const columns = columnIds
    .map((id) => {
      const colDef = def.columns.find((c) => c.id === id);
      if (!colDef) return null;
      return {
        id,
        label: config.columnLabels?.[id] ?? colDef.label,
        type: colDef.type,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);

  const projectedRows = rows.map((row) => {
    const out: ReportRow = {};
    for (const col of columns) {
      out[col.id] = row[col.id];
    }
    return out;
  });

  const branding = config.branding ?? {};
  const title = branding.title ?? def.label;
  const subtitle =
    branding.subtitle ??
    (branding.showLocation !== false && locationName
      ? locationName
      : undefined);

  return {
    reportId: config.reportId,
    title,
    subtitle,
    footer: branding.footer,
    columns,
    rows: projectedRows,
    meta: {
      totalRows: filtered.length,
      generatedAt: new Date().toISOString(),
      locationName: branding.showLocation !== false ? locationName : undefined,
    },
  };
}
