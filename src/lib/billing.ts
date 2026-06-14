import { addMonths, startOfDay } from "date-fns";
import type { PlanId } from "./plans";
import { PLAN_BY_ID } from "./plans";

export function planMonthlyAmount(plan: PlanId): number {
  return PLAN_BY_ID[plan]?.price ?? 0;
}

export function defaultNextBillingDate(from = new Date()): Date {
  return startOfDay(addMonths(from, 1));
}

export function maskCardLast4(last4: string): string {
  const digits = last4.replace(/\D/g, "").slice(-4);
  return digits.padStart(4, "0");
}

export function isValidExpiry(month: number, year: number): boolean {
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const exp = new Date(year < 100 ? 2000 + year : year, month - 1, 1);
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  return exp >= current;
}

export function detectCardBrand(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  if (/^4/.test(digits)) return "Visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^6(?:011|5)/.test(digits)) return "Discover";
  return "Card";
}

export function passesLuhnCheck(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function parseCardNumber(cardNumber: string): { last4: string; brand: string } | null {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return null;
  if (!passesLuhnCheck(digits)) return null;
  return {
    last4: maskCardLast4(digits),
    brand: detectCardBrand(digits),
  };
}

/** Fields that must never be sent or stored — reject at the API boundary. */
export const FORBIDDEN_PAYMENT_FIELDS = [
  "cvv",
  "cvc",
  "securityCode",
  "cardCvv",
  "cardCvc",
  "pin",
] as const;

export function containsForbiddenPaymentFields(body: Record<string, unknown>): boolean {
  return FORBIDDEN_PAYMENT_FIELDS.some((field) => {
    const value = body[field];
    return value != null && String(value).trim() !== "";
  });
}
