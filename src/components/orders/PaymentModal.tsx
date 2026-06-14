"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  Gift,
  Smartphone,
  Wallet,
  CircleDollarSign,
} from "lucide-react";
import type { PaymentMethod } from "@prisma/client";
import { Button } from "@/components/ui";
import { Input, FormField, Modal } from "@/components/ui/form";
import { apiPost } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  getOrderAmountDue,
  getOrderBalanceDue,
  getPaymentsTotal,
  getTipsTotal,
  PAYMENT_METHODS,
  roundMoney,
} from "@/lib/orders";
import { cn } from "@/lib/utils";

interface OrderPayment {
  id: string;
  method: PaymentMethod;
  amount: number;
  tipAmount: number;
  reference: string | null;
  createdAt?: string | Date;
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  menuItem: { name: string };
}

interface Table {
  id: string;
  number: number;
}

export interface PayableOrder {
  id: string;
  status: string;
  totalAmount: number;
  discountAmount?: number | null;
  compAmount?: number | null;
  voidAmount?: number | null;
  table: Table | null;
  items: OrderItem[];
  payments?: OrderPayment[];
}

const METHOD_ICONS: Record<PaymentMethod, React.ComponentType<{ className?: string }>> = {
  CASH: Banknote,
  CARD: CreditCard,
  DEBIT: Wallet,
  MOBILE: Smartphone,
  GIFT_CARD: Gift,
  OTHER: CircleDollarSign,
};

interface PaymentModalProps {
  open: boolean;
  order: PayableOrder | null;
  onClose: () => void;
  onPaid: (order: PayableOrder, meta: { changeDue: number | null; fullyPaid: boolean }) => void;
}

export function PaymentModal({ open, order, onClose, onPaid }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amount, setAmount] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [cashTendered, setCashTendered] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<number | null>(null);

  const payments = order?.payments ?? [];
  const amountDue = order ? getOrderAmountDue(order) : 0;
  const paidSoFar = getPaymentsTotal(payments);
  const balanceDue = order ? getOrderBalanceDue(order, payments) : 0;
  const tipsSoFar = getTipsTotal(payments);

  const paymentAmount = roundMoney(parseFloat(amount) || 0);
  const tip = roundMoney(parseFloat(tipAmount) || 0);
  const tendered = roundMoney(parseFloat(cashTendered) || 0);
  const changePreview =
    method === "CASH" && tendered > 0
      ? roundMoney(Math.max(0, tendered - paymentAmount - tip))
      : null;

  useEffect(() => {
    if (!open || !order) return;
    setMethod("CASH");
    setAmount(balanceDue > 0 ? balanceDue.toFixed(2) : "");
    setTipAmount("");
    setCashTendered("");
    setReference("");
    setError(null);
    setLastChange(null);
  }, [open, order, balanceDue]);

  const canSubmit = useMemo(() => {
    if (!order || balanceDue <= 0) return false;
    if (paymentAmount <= 0 || paymentAmount > balanceDue + 0.001) return false;
    if (tip < 0) return false;
    if (method === "CASH" && cashTendered && tendered < paymentAmount + tip) return false;
    return true;
  }, [order, balanceDue, paymentAmount, tip, method, cashTendered, tendered]);

  const handlePay = async () => {
    if (!order || !canSubmit) return;

    setSaving(true);
    setError(null);
    setLastChange(null);
    try {
      const result = await apiPost<{
        order: PayableOrder;
        changeDue: number | null;
        balanceDue: number;
        fullyPaid: boolean;
      }>(`/api/orders/${order.id}/pay`, {
        method,
        amount: paymentAmount,
        tipAmount: tip,
        cashTendered: method === "CASH" && cashTendered ? tendered : undefined,
        reference: reference || undefined,
      });

      if (result.changeDue != null) {
        setLastChange(result.changeDue);
      }

      onPaid(result.order, {
        changeDue: result.changeDue,
        fullyPaid: result.fullyPaid,
      });

      if (result.fullyPaid) {
        onClose();
      } else {
        setAmount(result.balanceDue > 0 ? result.balanceDue.toFixed(2) : "");
        setTipAmount("");
        setCashTendered("");
        setReference("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  return (
    <Modal open={open} onClose={onClose} title="Take Payment">
      <div className="space-y-5">
        <div className="rounded-lg border bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Order #{order.id.slice(-6)}
                {order.table ? ` · Table ${order.table.number}` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">{order.items.length} items on check</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">Balance due</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(balanceDue)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-600">
            <div>
              <span className="block text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-800">{formatCurrency(amountDue)}</span>
            </div>
            <div>
              <span className="block text-slate-500">Paid</span>
              <span className="font-medium text-slate-800">{formatCurrency(paidSoFar)}</span>
            </div>
            <div>
              <span className="block text-slate-500">Tips</span>
              <span className="font-medium text-slate-800">{formatCurrency(tipsSoFar)}</span>
            </div>
          </div>
        </div>

        {payments.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payments so far
            </p>
            <ul className="space-y-1 text-sm text-slate-600">
              {payments.map((payment) => (
                <li key={payment.id} className="flex justify-between rounded-md bg-white px-3 py-2 ring-1 ring-slate-200">
                  <span>
                    {PAYMENT_METHODS.find((m) => m.value === payment.method)?.label ?? payment.method}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(payment.amount)}
                    {payment.tipAmount > 0 ? ` + ${formatCurrency(payment.tipAmount)} tip` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payment method
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAYMENT_METHODS.map((option) => {
              const Icon = METHOD_ICONS[option.value];
              const active = method === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMethod(option.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    active
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Payment amount">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormField>
          <FormField label="Tip">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
            />
          </FormField>
        </div>

        {method === "CASH" && (
          <FormField label="Cash tendered">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={cashTendered}
              onChange={(e) => setCashTendered(e.target.value)}
              placeholder="Amount customer handed you"
            />
            {changePreview != null && tendered > 0 && (
              <p className="mt-1 text-sm font-medium text-emerald-700">
                Change due: {formatCurrency(changePreview)}
              </p>
            )}
          </FormField>
        )}

        {(method === "CARD" || method === "DEBIT" || method === "MOBILE") && (
          <FormField label="Reference (optional)">
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Last 4 digits or auth code"
            />
          </FormField>
        )}

        {lastChange != null && lastChange > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Give customer {formatCurrency(lastChange)} in change.
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePay} disabled={saving || !canSubmit}>
            {saving ? "Processing..." : balanceDue <= paymentAmount ? "Complete payment" : "Apply payment"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
