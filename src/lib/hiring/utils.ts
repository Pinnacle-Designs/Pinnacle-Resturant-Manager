import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

export function generateApplyCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

export function generateOnboardingToken(): string {
  return randomBytes(24).toString("hex");
}

export async function getOrCreateHiringSettings(locationId: string) {
  return prisma.hiringSettings.upsert({
    where: { locationId },
    create: { locationId },
    update: {},
  });
}

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "")
  );
}

export function onboardingUrl(token: string): string {
  return `${appBaseUrl()}/onboard/hire/${token}`;
}
