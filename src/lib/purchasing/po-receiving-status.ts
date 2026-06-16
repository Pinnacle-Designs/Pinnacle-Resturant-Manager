import { prisma } from "@/lib/prisma";

export type PoReceivingGroup = "pending" | "received";

export type PoPaymentStatus =
  | "AWAITING_DELIVERY"
  | "AWAITING_INVOICE"
  | "PENDING_MATCH"
  | "ON_HOLD"
  | "APPROVED"
  | "PAID";

export interface PoInvoiceSlice {
  id: string;
  matchStatus: string;
  accountingSyncLocked?: boolean;
  paymentHoldReason?: string | null;
  paidAt?: string | Date | null;
  amount?: number;
  invoiceNumber?: string | null;
}

export interface PoForStatus {
  id: string;
  poNumber?: string | null;
  vendor?: string | null;
  status: string;
  totalAmount: number;
  matchStatus?: string;
  submittedAt?: Date | string;
  receipts?: { id: string }[];
  invoices?: PoInvoiceSlice[];
  lines?: Array<{ qtyOrdered: number; qtyReceived: number; description: string }>;
}

export const PO_PAYMENT_LABELS: Record<PoPaymentStatus, string> = {
  AWAITING_DELIVERY: "Awaiting delivery",
  AWAITING_INVOICE: "Awaiting invoice",
  PENDING_MATCH: "Pending three-way match",
  ON_HOLD: "Hold — do not pay",
  APPROVED: "Approved to pay",
  PAID: "Paid",
};

export const PO_PAYMENT_COLORS: Record<PoPaymentStatus, string> = {
  AWAITING_DELIVERY: "bg-slate-100 text-slate-700",
  AWAITING_INVOICE: "bg-blue-100 text-blue-800",
  PENDING_MATCH: "bg-amber-100 text-amber-800",
  ON_HOLD: "bg-red-100 text-red-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  PAID: "bg-green-100 text-green-800",
};

/** POs shown on POs & Receiving — excludes drafts and cancelled. */
export function getPoReceivingGroup(status: string): PoReceivingGroup | null {
  if (status === "DRAFT" || status === "CANCELLED") return null;
  if (status === "RECEIVED") return "received";
  return "pending";
}

export function derivePoPaymentStatus(
  po: PoForStatus,
  openCreditInvoiceIds?: Set<string>
): PoPaymentStatus {
  const hasReceipts = (po.receipts?.length ?? 0) > 0;

  if (po.status === "SUBMITTED" && !hasReceipts) {
    return "AWAITING_DELIVERY";
  }

  const invoices = po.invoices ?? [];
  if (invoices.length === 0) {
    if (hasReceipts || po.status === "PARTIALLY_RECEIVED" || po.status === "RECEIVED") {
      return "AWAITING_INVOICE";
    }
    return "AWAITING_DELIVERY";
  }

  if (invoices.every((inv) => inv.paidAt)) {
    return "PAID";
  }

  for (const inv of invoices) {
    if (
      inv.matchStatus === "DISCREPANCY" ||
      inv.accountingSyncLocked ||
      inv.paymentHoldReason ||
      openCreditInvoiceIds?.has(inv.id)
    ) {
      return "ON_HOLD";
    }
  }

  if (invoices.some((inv) => inv.matchStatus === "PENDING")) {
    return "PENDING_MATCH";
  }

  if (invoices.some((inv) => inv.matchStatus === "MATCHED")) {
    return "APPROVED";
  }

  return "PENDING_MATCH";
}

export function paymentStatusDetail(po: PoForStatus, status: PoPaymentStatus): string | null {
  const inv = po.invoices?.[0];
  if (status === "ON_HOLD" && inv?.paymentHoldReason) return inv.paymentHoldReason;
  if (status === "PAID" && inv?.paidAt) {
    const d = new Date(inv.paidAt);
    return `Paid ${d.toLocaleDateString()}`;
  }
  if (status === "APPROVED" && inv) {
    return inv.invoiceNumber ? `Invoice ${inv.invoiceNumber} matched` : "Three-way match passed";
  }
  if (status === "PENDING_MATCH" && inv?.matchNotes) return inv.matchNotes;
  return null;
}

export interface PoReceivingRow {
  id: string;
  poNumber: string | null;
  vendor: string | null;
  status: string;
  totalAmount: number;
  receivingGroup: PoReceivingGroup;
  paymentStatus: PoPaymentStatus;
  paymentDetail: string | null;
  invoiceCount: number;
  receiptCount: number;
}

export interface PoReceivingSummary {
  pendingCount: number;
  receivedCount: number;
  pendingTotal: number;
  receivedTotal: number;
  paidCount: number;
  onHoldCount: number;
  awaitingInvoiceCount: number;
  approvedCount: number;
  orders: PoReceivingRow[];
}

export async function getPoReceivingSummary(locationId: string): Promise<PoReceivingSummary> {
  const [orders, openCredits] = await Promise.all([
    prisma.vendorPurchaseOrder.findMany({
      where: {
        locationId,
        status: { notIn: ["DRAFT", "CANCELLED"] },
      },
      include: { receipts: true, invoices: true },
      orderBy: { submittedAt: "desc" },
      take: 40,
    }),
    prisma.vendorCredit.findMany({
      where: { locationId, status: "OPEN", invoiceId: { not: null } },
      select: { invoiceId: true },
    }),
  ]);

  const lockedInvoiceIds = new Set(
    openCredits.map((c) => c.invoiceId).filter((id): id is string => Boolean(id))
  );

  const rows: PoReceivingRow[] = [];
  let pendingCount = 0;
  let receivedCount = 0;
  let pendingTotal = 0;
  let receivedTotal = 0;
  let paidCount = 0;
  let onHoldCount = 0;
  let awaitingInvoiceCount = 0;
  let approvedCount = 0;

  for (const po of orders) {
    const group = getPoReceivingGroup(po.status);
    if (!group) continue;

    const paymentStatus = derivePoPaymentStatus(po, lockedInvoiceIds);
    const paymentDetail = paymentStatusDetail(po, paymentStatus);

    if (group === "pending") {
      pendingCount++;
      pendingTotal += po.totalAmount;
    } else {
      receivedCount++;
      receivedTotal += po.totalAmount;
    }

    if (paymentStatus === "PAID") paidCount++;
    if (paymentStatus === "ON_HOLD") onHoldCount++;
    if (paymentStatus === "AWAITING_INVOICE") awaitingInvoiceCount++;
    if (paymentStatus === "APPROVED") approvedCount++;

    rows.push({
      id: po.id,
      poNumber: po.poNumber,
      vendor: po.vendor,
      status: po.status,
      totalAmount: po.totalAmount,
      receivingGroup: group,
      paymentStatus,
      paymentDetail,
      invoiceCount: po.invoices.length,
      receiptCount: po.receipts.length,
    });
  }

  return {
    pendingCount,
    receivedCount,
    pendingTotal,
    receivedTotal,
    paidCount,
    onHoldCount,
    awaitingInvoiceCount,
    approvedCount,
    orders: rows,
  };
}
