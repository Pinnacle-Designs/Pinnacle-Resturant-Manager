import type { FloorPlanSection } from "./floor-plan-constants";

export const SECTION_PAD = 40;
export const SECTION_LABEL = 22;
export const TABLE_GAP = 16;
export const CANVAS_MARGIN = 48;
export const MIN_SECTION_WIDTH = 200;
export const MIN_SECTION_HEIGHT = 140;

export interface TableBounds {
  section: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
}

export function defaultTableDimensions(shape: string): { width: number; height: number } {
  if (shape === "bar") return { width: 48, height: 100 };
  if (shape === "rectangle") return { width: 100, height: 72 };
  if (shape === "square") return { width: 80, height: 80 };
  return { width: 72, height: 72 };
}

/** Next grid slot inside a dining area for a newly added table. */
export function nextTablePositionInSection(
  section: FloorPlanSection,
  existing: TableBounds[],
  tableWidth: number,
  tableHeight: number
): { posX: number; posY: number } {
  const innerLeft = section.x + SECTION_PAD;
  const innerTop = section.y + SECTION_PAD + SECTION_LABEL;
  const innerWidth = Math.max(section.width - SECTION_PAD * 2, tableWidth);
  const cols = Math.max(1, Math.floor(innerWidth / (tableWidth + TABLE_GAP)));
  const index = existing.length;
  const row = Math.floor(index / cols);
  const col = index % cols;
  return {
    posX: innerLeft + col * (tableWidth + TABLE_GAP),
    posY: innerTop + row * (tableHeight + TABLE_GAP),
  };
}

function sectionTables(sectionId: string, tables: TableBounds[]) {
  return tables.filter((t) => t.section === sectionId);
}

/** Grow each dining area to fit its tables; expand canvas and nudge neighbors if needed. */
export function fitFloorPlanToTables(
  sections: FloorPlanSection[],
  tables: TableBounds[],
  planWidth: number,
  planHeight: number
): { sections: FloorPlanSection[]; tables: TableBounds[]; width: number; height: number } {
  const nextSections = sections.map((s) => ({ ...s }));
  const nextTables = tables.map((t) => ({ ...t }));

  for (const section of nextSections) {
    const inSection = sectionTables(section.id, nextTables);
    if (inSection.length === 0) continue;

    const right = Math.max(...inSection.map((t) => t.posX + t.width));
    const bottom = Math.max(...inSection.map((t) => t.posY + t.height));

    section.width = Math.max(
      section.width,
      MIN_SECTION_WIDTH,
      right - section.x + SECTION_PAD
    );
    section.height = Math.max(
      section.height,
      MIN_SECTION_HEIGHT,
      bottom - section.y + SECTION_PAD
    );
  }

  const sorted = [...nextSections].sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const minX = prev.x + prev.width + 24;
    if (cur.x < minX) {
      const shift = minX - cur.x;
      cur.x += shift;
      for (const t of nextTables) {
        if (t.section === cur.id) {
          t.posX += shift;
        }
      }
    }
  }

  const width = Math.max(
    planWidth,
    ...nextSections.map((s) => s.x + s.width + CANVAS_MARGIN)
  );
  const height = Math.max(
    planHeight,
    ...nextSections.map((s) => s.y + s.height + CANVAS_MARGIN)
  );

  return { sections: nextSections, tables: nextTables, width, height };
}

/** Place a new table and expand its dining area in one step. */
export function layoutNewTable(
  sections: FloorPlanSection[],
  tables: TableBounds[],
  planWidth: number,
  planHeight: number,
  sectionId: string,
  shape: string
): {
  sections: FloorPlanSection[];
  tables: TableBounds[];
  width: number;
  height: number;
  posX: number;
  posY: number;
  tableWidth: number;
  tableHeight: number;
} {
  const dims = defaultTableDimensions(shape);
  const section = sections.find((s) => s.id === sectionId) ?? sections[0];
  const inSection = sectionTables(section.id, tables);
  const { posX, posY } = nextTablePositionInSection(
    section,
    inSection,
    dims.width,
    dims.height
  );

  const draft: TableBounds[] = [
    ...tables,
    {
      section: section.id,
      posX,
      posY,
      width: dims.width,
      height: dims.height,
    },
  ];

  const fitted = fitFloorPlanToTables(sections, draft, planWidth, planHeight);
  const placed = fitted.tables[fitted.tables.length - 1];

  return {
    ...fitted,
    posX: placed.posX,
    posY: placed.posY,
    tableWidth: placed.width,
    tableHeight: placed.height,
  };
}

export function toTableBounds(
  tables: Array<{
    section: string;
    posX: number;
    posY: number;
    width: number;
    height: number;
  }>
): TableBounds[] {
  return tables.map((t) => ({
    section: t.section,
    posX: t.posX,
    posY: t.posY,
    width: t.width,
    height: t.height,
  }));
}
