import type { PaymentMethod } from "@prisma/client";

export type OrderTotalsInput = {
  totalAmount: number;
  discountAmount?: number | null;
  compAmount?: number | null;
  voidAmount?: number | null;
};

export type OrderPaymentInput = {
  amount: number;
  tipAmount?: number | null;
};

export function getOrderAmountDue(order: OrderTotalsInput): number {
  const due =
    order.totalAmount -
    (order.discountAmount ?? 0) -
    (order.compAmount ?? 0) -
    (order.voidAmount ?? 0);
  return Math.max(0, Math.round(due * 100) / 100);
}

export function getPaymentsTotal(payments: OrderPaymentInput[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function getTipsTotal(payments: OrderPaymentInput[]): number {
  return payments.reduce((sum, payment) => sum + (payment.tipAmount ?? 0), 0);
}

export function getOrderBalanceDue(
  order: OrderTotalsInput,
  payments: OrderPaymentInput[]
): number {
  const remaining = getOrderAmountDue(order) - getPaymentsTotal(payments);
  return Math.max(0, Math.round(remaining * 100) / 100);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Credit Card" },
  { value: "DEBIT", label: "Debit Card" },
  { value: "MOBILE", label: "Mobile Pay" },
  { value: "GIFT_CARD", label: "Gift Card" },
  { value: "OTHER", label: "Other" },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Credit Card",
  DEBIT: "Debit Card",
  MOBILE: "Mobile Pay",
  GIFT_CARD: "Gift Card",
  OTHER: "Other",
};
