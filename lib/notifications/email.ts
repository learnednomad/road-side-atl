import { Resend } from "resend";
import { formatPrice } from "@/lib/utils";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM || "noreply@roadsideatl.com";

// Generic email sender for verification/password reset emails
export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const resend = getResend();
  if (!resend) {
    console.warn("Email sending skipped - RESEND_API_KEY not configured");
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

interface BookingInfo {
  id: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  location: { address: string };
  estimatedPrice: number;
}

interface ProviderInfo {
  name: string;
  email: string;
  phone: string;
}

export async function sendBookingConfirmation(booking: BookingInfo) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to: booking.contactEmail,
    subject: `Booking Confirmed - RoadSide ATL #${booking.id.slice(0, 8)}`,
    html: `
      <h2>Your booking has been received!</h2>
      <p>Hi ${booking.contactName},</p>
      <p>We've received your roadside assistance request.</p>
      <ul>
        <li><strong>Booking ID:</strong> ${booking.id.slice(0, 8)}</li>
        <li><strong>Location:</strong> ${booking.location.address}</li>
        <li><strong>Estimated Price:</strong> ${formatPrice(booking.estimatedPrice)}</li>
      </ul>
      <p>We'll assign a provider shortly and keep you updated.</p>
      <p>— RoadSide ATL</p>
    `,
  });
}

export async function sendProviderAssignment(booking: BookingInfo, provider: ProviderInfo) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to: provider.email,
    subject: `New Job Assignment - Booking #${booking.id.slice(0, 8)}`,
    html: `
      <h2>New Job Assigned</h2>
      <p>Hi ${provider.name},</p>
      <p>You've been assigned a new job.</p>
      <ul>
        <li><strong>Customer:</strong> ${booking.contactName}</li>
        <li><strong>Phone:</strong> ${booking.contactPhone}</li>
        <li><strong>Location:</strong> ${booking.location.address}</li>
        <li><strong>Estimated Price:</strong> ${formatPrice(booking.estimatedPrice)}</li>
      </ul>
      <p>Please log in to your provider portal to accept or manage this job.</p>
      <p>— RoadSide ATL</p>
    `,
  });
}

export async function sendStatusUpdate(booking: BookingInfo, newStatus: string) {
  const resend = getResend();
  if (!resend) return;

  const statusMessages: Record<string, string> = {
    confirmed: "Your booking has been confirmed. A provider will be assigned shortly.",
    dispatched: "A provider has been dispatched to your location.",
    in_progress: "Your service is now in progress.",
    completed: "Your service has been completed. Thank you for choosing RoadSide ATL!",
    cancelled: "Your booking has been cancelled.",
  };

  const message = statusMessages[newStatus] || `Your booking status has been updated to: ${newStatus}`;

  await resend.emails.send({
    from: FROM,
    to: booking.contactEmail,
    subject: `Booking Update - #${booking.id.slice(0, 8)}`,
    html: `
      <h2>Booking Status Update</h2>
      <p>Hi ${booking.contactName},</p>
      <p>${message}</p>
      <p>Booking ID: ${booking.id.slice(0, 8)}</p>
      <p>— RoadSide ATL</p>
    `,
  });
}
