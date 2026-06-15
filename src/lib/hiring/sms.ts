import { prisma } from "@/lib/prisma";
import type { SmsDirection } from "@prisma/client";
import { normalizePhone } from "./utils";

interface SendSmsInput {
  locationId: string;
  applicantId?: string;
  toPhone: string;
  body: string;
  fromPhone?: string;
}

/** Send SMS via Twilio when configured; otherwise queue in DB (dev/simulated). */
export async function sendSms(input: SendSmsInput) {
  const settings = await prisma.hiringSettings.findUnique({
    where: { locationId: input.locationId },
  });

  const fromPhone =
    input.fromPhone || settings?.applyPhone || process.env.TWILIO_PHONE_NUMBER || "+15550001234";
  const toPhone = normalizePhone(input.toPhone);

  let status = "simulated";
  let externalId: string | null = null;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (accountSid && authToken && settings?.smsEnabled) {
    try {
      const params = new URLSearchParams({
        To: toPhone,
        From: fromPhone,
        Body: input.body,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        }
      );
      const json = await res.json();
      if (res.ok) {
        status = "sent";
        externalId = json.sid ?? null;
      } else {
        status = "failed";
        console.error("Twilio SMS failed:", json);
      }
    } catch (err) {
      status = "failed";
      console.error("Twilio SMS error:", err);
    }
  } else if (process.env.NODE_ENV === "development") {
    console.log(`[SMS simulated] To ${toPhone}: ${input.body}`);
  }

  return prisma.smsMessage.create({
    data: {
      locationId: input.locationId,
      applicantId: input.applicantId,
      direction: "OUTBOUND" satisfies SmsDirection,
      toPhone,
      fromPhone,
      body: input.body,
      status,
      externalId,
    },
  });
}

export async function sendInterviewReminder(
  locationId: string,
  applicantId: string,
  phone: string,
  applicantName: string,
  scheduledAt: Date,
  locationName: string
) {
  const when = scheduledAt.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const body = `Hi ${applicantName.split(" ")[0]}! Interview reminder for ${locationName} on ${when}. Reply YES to confirm or RESCHEDULE to request a new time.`;
  return sendSms({ locationId, applicantId, toPhone: phone, body });
}

export async function sendOnboardingLink(
  locationId: string,
  applicantId: string,
  phone: string,
  applicantName: string,
  url: string,
  locationName: string
) {
  const body = `Welcome to ${locationName}, ${applicantName.split(" ")[0]}! Complete your mobile onboarding (I-9, W-4, direct deposit) before your first shift: ${url}`;
  return sendSms({ locationId, applicantId, toPhone: phone, body });
}
