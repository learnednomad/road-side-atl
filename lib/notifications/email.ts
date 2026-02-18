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

export async function sendProviderAssignment(booking: BookingInfo, provider: ProviderInfo, estimatedPayout?: number) {
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
        ${estimatedPayout ? `<li><strong>Your Estimated Payout:</strong> ${formatPrice(estimatedPayout)}</li>` : ""}
      </ul>
      <p>Please log in to your provider portal to accept or manage this job.</p>
      <p>— RoadSide ATL</p>
    `,
  });
}

export async function sendStatusUpdate(booking: BookingInfo, newStatus: string, amountPaid?: number) {
  const resend = getResend();
  if (!resend) return;

  const statusMessages: Record<string, string> = {
    confirmed: "Your booking has been confirmed. A provider will be assigned shortly.",
    dispatched: "A provider has been dispatched to your location.",
    in_progress: "Your service is now in progress.",
    completed: amountPaid
      ? `Your service has been completed. Amount paid: ${formatPrice(amountPaid)}. Thank you for choosing RoadSide ATL!`
      : "Your service has been completed. Thank you for choosing RoadSide ATL!",
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

export async function sendObservationFollowUpEmail(email: string, customerName: string, findings: string) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Vehicle Observation - RoadSide ATL",
    html: `
      <h2>Vehicle Observation Report</h2>
      <p>Hi ${customerName},</p>
      <p>During your recent service, our provider noticed some items that may need attention:</p>
      <p>${findings}</p>
      <p>We recommend booking a diagnostic inspection for a thorough assessment.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/book">Book an Inspection</a></p>
      <p>— RoadSide ATL</p>
      <p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/unsubscribe">unsubscribe here</a>.</p>
    `,
  });
}

export async function sendPreServiceConfirmationEmail(
  email: string,
  customerName: string,
  inspectorName: string,
  eta: string,
  serviceName: string
) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your Inspector ${inspectorName} Is On the Way - RoadSide ATL`,
    html: `
      <h2>Pre-Service Confirmation</h2>
      <p>Hi ${customerName},</p>
      <p>Your <strong>${serviceName}</strong> has been assigned to inspector <strong>${inspectorName}</strong>.</p>
      <p>Estimated arrival: <strong>${eta}</strong></p>
      <p>Please ensure the vehicle is accessible at the specified location.</p>
      <p>— RoadSide ATL</p>
      <p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/unsubscribe">unsubscribe here</a>.</p>
    `,
  });
}

export async function sendReferralCreditEmail(email: string, name: string, amount: number) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "You Earned a Referral Credit! - RoadSide ATL",
    html: `
      <h2>Referral Credit Earned!</h2>
      <p>Hi ${name},</p>
      <p>You just earned a <strong>${formatPrice(amount)}</strong> referral credit on RoadSide ATL!</p>
      <p>This credit will be automatically available to apply on your next booking.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/dashboard/referrals">View Your Referrals</a></p>
      <p>— RoadSide ATL</p>
      <p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/unsubscribe">unsubscribe here</a>.</p>
    `,
  });
}

export async function sendTierPromotionEmail(email: string, name: string) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Card Payments Unlocked! - RoadSide ATL",
    html: `
      <h2>Congratulations, ${name}!</h2>
      <p>You've earned Trusted Customer status on RoadSide ATL.</p>
      <p>You can now pay with <strong>credit and debit cards</strong> in addition to Cash, CashApp, and Zelle.</p>
      <p>Thank you for being a loyal customer!</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/book">Book Your Next Service</a></p>
      <p>— RoadSide ATL</p>
      <p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/unsubscribe">unsubscribe here</a>.</p>
    `,
  });
}

export async function sendInspectionReportEmail(
  email: string,
  customerName: string,
  bookingId: string,
  vehicleDescription: string,
  reportUrl: string
) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Vehicle Inspection Report - RoadSide ATL #${bookingId.slice(0, 8)}`,
    html: `
      <h2>Your Vehicle Inspection Report</h2>
      <p>Hi ${customerName},</p>
      <p>Your inspection report for the <strong>${vehicleDescription}</strong> is ready.</p>
      <p><a href="${reportUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a2e; color: white; text-decoration: none; border-radius: 6px;">View Report</a></p>
      <p>You can also download the PDF version from the link above.</p>
      <p>— RoadSide ATL</p>
      <p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/unsubscribe">unsubscribe here</a>.</p>
    `,
  });
}

const PAYMENT_METHOD_DISPLAY: Record<string, string> = {
  cash: "Cash",
  cashapp: "CashApp",
  zelle: "Zelle",
  stripe: "Card",
};

function formatPaymentMethod(method: string): string {
  return PAYMENT_METHOD_DISPLAY[method] || method.charAt(0).toUpperCase() + method.slice(1);
}

export async function sendPaymentReceiptEmail(
  email: string,
  customerName: string,
  bookingId: string,
  serviceName: string,
  amountPaid: number,
  paymentMethod: string,
  paymentDate: string,
  providerName?: string
) {
  const resend = getResend();
  if (!resend) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com";
  const receiptUrl = `${appUrl}/api/receipts/${bookingId}`;
  const displayMethod = formatPaymentMethod(paymentMethod);

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Payment Receipt - RoadSide ATL #${bookingId.slice(0, 8)}`,
    html: `
      <h2>Payment Receipt</h2>
      <p>Hi ${customerName},</p>
      <p>Your payment has been confirmed. Thank you!</p>
      <ul>
        <li><strong>Booking ID:</strong> ${bookingId.slice(0, 8)}</li>
        <li><strong>Service:</strong> ${serviceName}</li>
        <li><strong>Amount Paid:</strong> ${formatPrice(amountPaid)}</li>
        <li><strong>Payment Method:</strong> ${displayMethod}</li>
        <li><strong>Date:</strong> ${new Date(paymentDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</li>
        ${providerName ? `<li><strong>Provider:</strong> ${providerName}</li>` : ""}
      </ul>
      <p><a href="${receiptUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a2e; color: white; text-decoration: none; border-radius: 6px;">View Full Receipt</a></p>
      <p>— RoadSide ATL</p>
      <p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${appUrl}/unsubscribe">unsubscribe here</a>.</p>
    `,
  });
}
