import { prisma } from "@/lib/prisma";
import { convertQuantity, parseAlternateUnits } from "./unit-convert";

export interface CountLineInput {
  inventoryItemId: string;
  countedQty: number;
  countUnit?: string;
  weighedGrams?: number;
  notes?: string;
  clientId?: string;
}

export async function startCountSession(
  locationId: string,
  zoneId?: string,
  startedBy?: string
) {
  return prisma.inventoryCountSession.create({
    data: {
      locationId,
      zoneId: zoneId ?? null,
      startedBy: startedBy ?? null,
      status: "IN_PROGRESS",
    },
    include: { zone: true },
  });
}

export async function getRouteForZone(zoneId: string) {
  const steps = await prisma.countRouteStep.findMany({
    where: { zoneId },
    include: { inventoryItem: true },
    orderBy: { sortOrder: "asc" },
  });
  return steps;
}

export async function addCountLine(
  sessionId: string,
  locationId: string,
  input: CountLineInput
) {
  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, locationId, status: "IN_PROGRESS" },
  });
  if (!session) throw new Error("Count session not found or already finalized");

  const item = await prisma.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, locationId },
  });
  if (!item) throw new Error("Inventory item not found");

  const alternates = parseAlternateUnits(item.alternateUnits);
  const countUnit = input.countUnit ?? item.unit;
  let countedQty = input.countedQty;

  if (countUnit !== item.unit) {
    countedQty = convertQuantity(countedQty, countUnit, item.unit, alternates);
  }

  const bookQty = item.quantity;
  const variance = countedQty - bookQty;

  const existing = await prisma.inventoryCountLine.findFirst({
    where: { sessionId, inventoryItemId: input.inventoryItemId },
  });

  const line = existing
    ? await prisma.inventoryCountLine.update({
        where: { id: existing.id },
        data: {
          countedQty,
          countUnit,
          weighedGrams: input.weighedGrams ?? null,
          variance,
          notes: input.notes ?? null,
          countedAt: new Date(),
        },
      })
    : await prisma.inventoryCountLine.create({
        data: {
          sessionId,
          inventoryItemId: input.inventoryItemId,
          bookQty,
          countedQty,
          unit: item.unit,
          countUnit,
          weighedGrams: input.weighedGrams ?? null,
          variance,
          notes: input.notes ?? null,
          clientId: input.clientId ?? null,
        },
      });

  return { line, item, bookQty, countedQty, variance };
}

export async function finalizeCountSession(sessionId: string, locationId: string) {
  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, locationId },
    include: { lines: { include: { inventoryItem: true } } },
  });
  if (!session) throw new Error("Session not found");
  if (session.status === "FINALIZED") throw new Error("Already finalized");

  for (const line of session.lines) {
    await prisma.inventoryItem.update({
      where: { id: line.inventoryItemId },
      data: { quantity: line.countedQty },
    });
  }

  const updated = await prisma.inventoryCountSession.update({
    where: { id: sessionId },
    data: { status: "FINALIZED", finalizedAt: new Date() },
    include: { lines: true, zone: true },
  });

  await prisma.activityLog.create({
    data: {
      locationId,
      action: "COUNT_FINALIZE",
      entity: "count_session",
      entityId: sessionId,
      details: `Walk-in count finalized — ${session.lines.length} lines, zone ${session.zone?.name ?? "all"}`,
    },
  });

  return updated;
}

export async function syncOfflineLines(
  locationId: string,
  sessionId: string,
  lines: CountLineInput[]
) {
  const results = [];
  for (const line of lines) {
    const result = await addCountLine(sessionId, locationId, line);
    results.push(result);
  }
  return results;
}
