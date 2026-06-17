import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/hiring/utils";

/** Send compliance SMS via Twilio env vars (independent of hiring SMS toggle). */
export async function sendComplianceAlertSms(params: {
  locationId: string;
  toPhone: string;
  body: string;
}): Promise<{ status: "sent" | "simulated" | "failed"; error?: string }> {
  const toPhone = normalizePhone(params.toPhone);
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    console.info("[compliance-sms:simulated]", toPhone, params.body);
    return { status: "simulated" };
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: toPhone, From: fromPhone, Body: params.body }).toString(),
      }
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { status: "failed", error: json.message || res.statusText };
    }
    return { status: "sent" };
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "SMS send failed",
    };
  }
}

export async function resolveManagerAlertPhone(locationId: string): Promise<string | null> {
  const [compliance, location] = await Promise.all([
    prisma.complianceSettings.findUnique({ where: { locationId } }),
    prisma.location.findUnique({ where: { id: locationId }, select: { phone: true } }),
  ]);
  const phone = compliance?.managerAlertPhone?.trim() || location?.phone?.trim();
  return phone || null;
}

const recentSmsKeys = new Map<string, number>();
const SMS_COOLDOWN_MS = 15 * 60 * 1000;

/** Throttled manager SMS for the same alert type per staff per window. */
export async function notifyManagerCompliance(params: {
  locationId: string;
  staffName: string;
  alertCode: string;
  message: string;
}): Promise<void> {
  const phone = await resolveManagerAlertPhone(params.locationId);
  if (!phone) return;

  const key = `${params.locationId}:${params.alertCode}:${params.staffName}`;
  const last = recentSmsKeys.get(key) ?? 0;
  if (Date.now() - last < SMS_COOLDOWN_MS) return;

  const location = await prisma.location.findUnique({
    where: { id: params.locationId },
    select: { name: true },
  });

  const body = `[Pinnacle ${location?.name ?? "Compliance"}] ${params.staffName}: ${params.message}`;
  await sendComplianceAlertSms({ locationId: params.locationId, toPhone: phone, body });
  recentSmsKeys.set(key, Date.now());
}
