import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  formatCurrencyAmount,
  formatDateLocalized,
  getActiveLocationLocale,
} from "@/lib/location/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return formatCurrencyAmount(amount, getActiveLocationLocale());
}

export function formatDate(date: Date | string): string {
  return formatDateLocalized(date, getActiveLocationLocale());
}
