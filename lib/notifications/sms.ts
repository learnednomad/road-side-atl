import { formatPrice } from "@/lib/utils";

interface TwilioMessage {
  sid: string;
  status: string;
}

interface TwilioClient {
  messages: {
    create: (opts: { body: string; to: string; from: string; statusCallback?: string }) => Promise<TwilioMessage>;
  };
}

let twilioClient: TwilioClient | null = null;

function getTwilio(): TwilioClient | null {
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_PHONE_NUMBER
  )
    return null;

  if (!twilioClient) {
    // Dynamic import to avoid requiring twilio when not configured
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require("twilio");
      twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    } catch {
      return null;
    }
  }
  return twilioClient;
}

// Simple in-memory rate limiter: 1 SMS per phone per 60s
const rateLimitMap = new Map<string, number>();

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const lastSent = rateLimitMap.get(phone);
  if (lastSent && now - lastSent < 60_000) return true;
  rateLimitMap.set(phone, now);
  // Cleanup old entries
  if (rateLimitMap.size > 1000) {
    for (const [key, time] of rateLimitMap) {
      if (now - time > 60_000) rateLimitMap.delete(key);
    }
  }
  return false;
}

export async function sendSMS(
  phone: string,
  message: string,
  options?: { statusCallback?: string }
): Promise<{ success: boolean; messageSid?: string }> {
  const client = getTwilio();
  if (!client) return { success: false };
  if (isRateLimited(phone)) return { success: false };

  try {
    const result = await client.messages.create({
      body: message,
      to: phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      ...(options?.statusCallback && { statusCallback: options.statusCallback }),
    });
    return { success: true, messageSid: result.sid };
  } catch {
    return { success: false };
  }
}

interface BookingInfo {
  id: string;
  contactName: string;
  location: { address: string };
  estimatedPrice: number;
}

export async function sendBookingConfirmationSMS(phone: string, booking: BookingInfo) {
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  await sendSMS(
    phone,
    `RoadSide ATL: Booking #${booking.id.slice(0, 8)} received! Location: ${booking.location.address}. Est: ${formatPrice(booking.estimatedPrice)}. We'll assign a provider shortly.`,
    statusCallbackUrl ? { statusCallback: statusCallbackUrl } : undefined
  );
}

export async function sendProviderAssignmentSMS(phone: string, booking: BookingInfo, estimatedPrice?: number, estimatedPayout?: number) {
  const payoutInfo = estimatedPrice && estimatedPayout
    ? ` Price: ${formatPrice(estimatedPrice)}. Your payout: ${formatPrice(estimatedPayout)}.`
    : "";
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  await sendSMS(
    phone,
    `RoadSide ATL: New job assigned! Booking #${booking.id.slice(0, 8)}. Customer: ${booking.contactName}. Location: ${booking.location.address}.${payoutInfo} Log in to accept.`,
    statusCallbackUrl ? { statusCallback: statusCallbackUrl } : undefined
  );
}

export async function sendStatusUpdateSMS(phone: string, booking: BookingInfo, status: string, amountPaid?: number) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const trackingUrl = baseUrl ? ` Track live: ${baseUrl}/track/${booking.id}` : "";
  const statusMessages: Record<string, string> = {
    confirmed: "confirmed",
    dispatched: `dispatched - provider is on the way.${trackingUrl}`,
    in_progress: "in progress",
    completed: amountPaid
      ? `completed. Amount paid: ${formatPrice(amountPaid)}. Thank you!`
      : "completed - thank you!",
    cancelled: "cancelled",
  };
  const msg = statusMessages[status] || status;
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  await sendSMS(
    phone,
    `RoadSide ATL: Booking #${booking.id.slice(0, 8)} is now ${msg}.`,
    statusCallbackUrl ? { statusCallback: statusCallbackUrl } : undefined
  );
}

export async function sendDelayNotificationSMS(phone: string, providerName: string, etaMinutes: number, trackingUrl: string) {
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  await sendSMS(
    phone,
    `RoadSide ATL: Your provider ${providerName} is running a bit late. Updated ETA: ~${etaMinutes} min. Track live: ${trackingUrl}`,
    statusCallbackUrl ? { statusCallback: statusCallbackUrl } : undefined
  );
}

export async function sendObservationFollowUpSMS(phone: string, findings: string) {
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  await sendSMS(
    phone,
    `RoadSide ATL: Our provider noticed some issues with your vehicle: ${findings}. Book a diagnostic inspection to learn more! Reply STOP to opt out.`,
    statusCallbackUrl ? { statusCallback: statusCallbackUrl } : undefined
  );
}

export async function sendPreServiceConfirmationSMS(
  phone: string,
  inspectorName: string,
  eta: string
) {
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  await sendSMS(
    phone,
    `RoadSide ATL: Your vehicle inspector ${inspectorName} is on the way! Estimated arrival: ${eta}. Reply STOP to opt out.`,
    statusCallbackUrl ? { statusCallback: statusCallbackUrl } : undefined
  );
}

export async function sendReferralSMS(phone: string, referralLink: string) {
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  await sendSMS(
    phone,
    `RoadSide ATL: Thanks for using our service! Share your referral link and earn $10 credit: ${referralLink} Reply STOP to opt out.`,
    statusCallbackUrl ? { statusCallback: statusCallbackUrl } : undefined
  );
}

export async function sendReferralCreditSMS(phone: string, amount: number) {
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  await sendSMS(
    phone,
    `RoadSide ATL: You earned a ${formatPrice(amount)} referral credit! It will be applied to your next booking. Reply STOP to opt out.`,
    statusCallbackUrl ? { statusCallback: statusCallbackUrl } : undefined
  );
}

export async function sendTierPromotionSMS(phone: string) {
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  await sendSMS(
    phone,
    `RoadSide ATL: Congratulations! You've unlocked card payments. You can now pay with credit/debit cards on your next booking. Reply STOP to opt out.`,
    statusCallbackUrl ? { statusCallback: statusCallbackUrl } : undefined
  );
}

const PAYMENT_METHOD_DISPLAY: Record<string, string> = {
  cash: "Cash",
  cashapp: "CashApp",
  zelle: "Zelle",
  stripe: "Card",
};

export async function sendPaymentReceiptSMS(phone: string, bookingId: string, amount: number, paymentMethod: string) {
  const displayMethod = PAYMENT_METHOD_DISPLAY[paymentMethod] || paymentMethod;
  await sendSMS(
    phone,
    `RoadSide ATL: Payment confirmed for booking #${bookingId.slice(0, 8)}. ${formatPrice(amount)} via ${displayMethod}. Thank you! Reply STOP to opt out.`
  );
}
