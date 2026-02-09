import { formatPrice } from "@/lib/utils";

interface TwilioClient {
  messages: {
    create: (opts: { body: string; to: string; from: string }) => Promise<unknown>;
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

export async function sendSMS(phone: string, message: string): Promise<boolean> {
  const client = getTwilio();
  if (!client) return false;
  if (isRateLimited(phone)) return false;

  try {
    await client.messages.create({
      body: message,
      to: phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
    });
    return true;
  } catch {
    return false;
  }
}

interface BookingInfo {
  id: string;
  contactName: string;
  location: { address: string };
  estimatedPrice: number;
}

export async function sendBookingConfirmationSMS(phone: string, booking: BookingInfo) {
  await sendSMS(
    phone,
    `RoadSide ATL: Booking #${booking.id.slice(0, 8)} received! Location: ${booking.location.address}. Est: ${formatPrice(booking.estimatedPrice)}. We'll assign a provider shortly.`
  );
}

export async function sendProviderAssignmentSMS(phone: string, booking: BookingInfo) {
  await sendSMS(
    phone,
    `RoadSide ATL: New job assigned! Booking #${booking.id.slice(0, 8)}. Customer: ${booking.contactName}. Location: ${booking.location.address}. Log in to accept.`
  );
}

export async function sendStatusUpdateSMS(phone: string, booking: BookingInfo, status: string) {
  const statusMessages: Record<string, string> = {
    confirmed: "confirmed",
    dispatched: "dispatched - provider is on the way",
    in_progress: "in progress",
    completed: "completed - thank you!",
    cancelled: "cancelled",
  };
  const msg = statusMessages[status] || status;
  await sendSMS(
    phone,
    `RoadSide ATL: Booking #${booking.id.slice(0, 8)} is now ${msg}.`
  );
}
