import { sendBookingConfirmation, sendProviderAssignment, sendStatusUpdate, sendObservationFollowUpEmail, sendReferralCreditEmail, sendPreServiceConfirmationEmail, sendInspectionReportEmail, sendTierPromotionEmail, sendPaymentReceiptEmail, sendB2bServiceDispatchedEmail, sendB2bInvoiceEmail } from "./email";

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
import {
  sendBookingConfirmationSMS,
  sendProviderAssignmentSMS,
  sendStatusUpdateSMS,
  sendObservationFollowUpSMS,
  sendPreServiceConfirmationSMS,
  sendReferralSMS,
  sendReferralCreditSMS,
  sendTierPromotionSMS,
  sendPaymentReceiptSMS,
  sendB2bServiceDispatchedSMS,
} from "./sms";
import { notifyBookingStatusPush, notifyProviderNewJobPush } from "./push";

interface BookingInfo {
  id: string;
  userId?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  location: { address: string };
  estimatedPrice: number;
}

interface ProviderInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export async function notifyBookingCreated(booking: BookingInfo) {
  const tasks: Promise<unknown>[] = [
    sendBookingConfirmation(booking),
    sendBookingConfirmationSMS(booking.contactPhone, booking),
  ];
  if (booking.userId) {
    tasks.push(notifyBookingStatusPush(booking.userId, booking.id, "confirmed"));
  }
  await Promise.allSettled(tasks);
}

export async function notifyProviderAssigned(booking: BookingInfo, provider: ProviderInfo, estimatedPrice?: number, estimatedPayout?: number, serviceName?: string) {
  const tasks: Promise<unknown>[] = [
    sendProviderAssignment(booking, provider, estimatedPayout),
    sendProviderAssignmentSMS(provider.phone, booking, estimatedPrice, estimatedPayout),
  ];
  tasks.push(notifyProviderNewJobPush(provider.id, booking.id, booking.contactName, serviceName || "Roadside Assistance"));
  await Promise.allSettled(tasks);
}

export async function notifyStatusChange(booking: BookingInfo, newStatus: string, amountPaid?: number) {
  const tasks: Promise<unknown>[] = [
    sendStatusUpdate(booking, newStatus, amountPaid),
    sendStatusUpdateSMS(booking.contactPhone, booking, newStatus, amountPaid),
  ];
  if (booking.userId) {
    tasks.push(notifyBookingStatusPush(booking.userId, booking.id, newStatus));
  }
  await Promise.allSettled(tasks);
}

export async function notifyObservationFollowUp(customer: { name: string; email: string; phone: string }, findings: string) {
  await Promise.allSettled([
    sendObservationFollowUpEmail(customer.email, customer.name, findings),
    sendObservationFollowUpSMS(customer.phone, findings),
  ]);
}

export async function notifyReferralLink(phone: string, referralLink: string) {
  await sendReferralSMS(phone, referralLink);
}

export async function notifyReferralCredit(phone: string, amount: number, email?: string, name?: string) {
  const tasks: Promise<unknown>[] = [sendReferralCreditSMS(phone, amount)];
  if (email && name) {
    tasks.push(sendReferralCreditEmail(email, name, amount));
  }
  await Promise.allSettled(tasks);
}

export async function notifyPreServiceConfirmation(
  customer: { name: string; email: string; phone: string },
  inspectorName: string,
  eta: string,
  serviceName: string
) {
  await Promise.allSettled([
    sendPreServiceConfirmationEmail(customer.email, customer.name, inspectorName, eta, serviceName),
    sendPreServiceConfirmationSMS(customer.phone, inspectorName, eta),
  ]);
}

export async function notifyTierPromotion(
  customer: { name: string; email: string; phone: string },
) {
  await Promise.allSettled([
    sendTierPromotionEmail(customer.email, customer.name),
    sendTierPromotionSMS(customer.phone),
  ]);
}

export async function notifyInspectionReport(
  customer: { name: string; email: string },
  bookingId: string,
  vehicleDescription: string,
  reportUrl: string,
  inspectionDate: string
) {
  await sendInspectionReportEmail(customer.email, customer.name, bookingId, vehicleDescription, reportUrl, inspectionDate);
}

export async function notifyB2bServiceDispatched(
  customer: { name: string; email: string; phone: string },
  companyName: string,
  serviceName: string,
  locationAddress: string
) {
  await Promise.allSettled([
    sendB2bServiceDispatchedEmail(customer.email, customer.name, companyName, serviceName, locationAddress),
    sendB2bServiceDispatchedSMS(customer.phone, companyName, serviceName),
  ]);
}

export async function notifyB2bInvoiceSent(
  contact: { name: string; email: string },
  companyName: string,
  invoiceNumber: string,
  lineItems: { description: string; quantity: number; unitPrice: number; total: number }[],
  totalCents: number,
  dueDate: Date | null,
  billingPeriodStart: string | null,
  billingPeriodEnd: string | null,
) {
  await Promise.allSettled([
    sendB2bInvoiceEmail(
      contact.email,
      contact.name,
      companyName,
      invoiceNumber,
      lineItems,
      totalCents,
      dueDate,
      billingPeriodStart,
      billingPeriodEnd,
    ),
  ]);
}

export async function notifyDocumentReviewed(
  userId: string | undefined,
  documentType: string,
  status: string,
  rejectionReason?: string,
) {
  if (!userId) return;
  // Lazy imports: called from admin-providers.ts which creates a circular
  // dependency chain if we use top-level imports (notifications → db → schema)
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema/users");
  const { eq } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.email) return;

  const subject = status === "approved"
    ? `Your ${documentType} document has been approved`
    : `Action required: Your ${documentType} document needs attention`;

  const safeName = escapeHtml(user.name || "Provider");
  const html = status === "approved"
    ? `<h2>Document Approved</h2><p>Hi ${safeName},</p><p>Your <strong>${escapeHtml(documentType)}</strong> document has been approved. You can check your onboarding progress on your dashboard.</p>`
    : `<h2>Document Needs Resubmission</h2><p>Hi ${safeName},</p><p>Your <strong>${escapeHtml(documentType)}</strong> document was not approved.</p><p><strong>Reason:</strong> ${escapeHtml(rejectionReason || "No reason provided")}</p><p>Please log in to your dashboard to upload a new document.</p>`;

  const { sendEmail } = await import("./email");
  await sendEmail({ to: user.email, subject, html });
}

export async function notifyBackgroundCheckResult(
  providerId: string,
  checkrStatus: string,
) {
  const { db } = await import("@/db");
  const { providers } = await import("@/db/schema/providers");
  const { users } = await import("@/db/schema/users");
  const { eq } = await import("drizzle-orm");

  const provider = await db.query.providers.findFirst({ where: eq(providers.id, providerId) });
  if (!provider) return;

  if (!provider.userId) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, provider.userId) });
  if (!user?.email) return;

  const safeName = escapeHtml(user.name || "Provider");
  const statusMessages: Record<string, { subject: string; html: string }> = {
    clear: {
      subject: "Background check cleared - You're one step closer!",
      html: `<h2>Background Check Cleared</h2><p>Hi ${safeName},</p><p>Great news! Your background check has been cleared. Check your onboarding dashboard to see your progress.</p>`,
    },
    consider: {
      subject: "Background check update - Under review",
      html: `<h2>Background Check Under Review</h2><p>Hi ${safeName},</p><p>Your background check requires additional review. Our team will review the results and update you shortly. No action is needed from you at this time.</p>`,
    },
    suspended: {
      subject: "Background check update",
      html: `<h2>Background Check Update</h2><p>Hi ${safeName},</p><p>Unfortunately, your background check did not meet our requirements. If you have questions, please contact support.</p>`,
    },
    adverse_action: {
      subject: "Background check update",
      html: `<h2>Background Check Update</h2><p>Hi ${safeName},</p><p>Unfortunately, your background check did not meet our requirements. You will receive a separate notice from Checkr with more details about your rights.</p>`,
    },
  };

  const message = statusMessages[checkrStatus];
  if (!message) {
    console.warn("[Notifications] Unknown Checkr status for notification: %s (providerId: %s)", checkrStatus, providerId);
    return;
  }
  const { sendEmail } = await import("./email");
  await sendEmail({ to: user.email, subject: message.subject, html: message.html });
}

export async function notifyAdjudicationResult(
  providerId: string,
  decision: "approve" | "adverse_action",
) {
  const { db } = await import("@/db");
  const { providers } = await import("@/db/schema/providers");
  const { users } = await import("@/db/schema/users");
  const { eq } = await import("drizzle-orm");

  const provider = await db.query.providers.findFirst({ where: eq(providers.id, providerId) });
  if (!provider?.userId) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, provider.userId) });
  if (!user?.email) return;

  const { sendEmail } = await import("./email");

  const safeName = escapeHtml(user.name || "Provider");
  if (decision === "approve") {
    await sendEmail({
      to: user.email,
      subject: "Background check review complete — You're cleared!",
      html: `<h2>Background Check Approved</h2><p>Hi ${safeName},</p><p>Great news! Your background check review is complete and you've been cleared to proceed with onboarding. Check your dashboard for next steps.</p>`,
    });
  } else {
    await sendEmail({
      to: user.email,
      subject: "Background check review complete — Action required",
      html: `<h2>Background Check Review Complete</h2><p>Hi ${safeName},</p><p>After review, your background check did not meet our requirements. You will receive a separate notice from Checkr with more details about your rights.</p><p>If you have questions, please contact our support team.</p>`,
    });
  }
}

export async function notifyStripeConnectReminder(
  providerId: string,
  hoursElapsed: number,
) {
  const { db } = await import("@/db");
  const { providers } = await import("@/db/schema/providers");
  const { users } = await import("@/db/schema/users");
  const { eq } = await import("drizzle-orm");

  const provider = await db.query.providers.findFirst({ where: eq(providers.id, providerId) });
  if (!provider?.userId) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, provider.userId) });
  if (!user?.email) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com";
  const dashboardLink = `${appUrl}/provider/onboarding`;

  const isFirstReminder = hoursElapsed <= 24;
  const subject = isFirstReminder
    ? "Complete your payment setup — You're almost done!"
    : "Reminder: Finish setting up your payouts";

  const safeName = escapeHtml(user.name || "Provider");
  const html = `<h2>${isFirstReminder ? "Almost There!" : "Don't Forget Your Payment Setup"}</h2>
<p>Hi ${safeName},</p>
<p>${isFirstReminder
  ? "You started setting up your payment account but haven't finished yet. Complete this step to start receiving payouts for your services."
  : "Your payment setup is still incomplete. You need to finish this step before you can receive payouts."
}</p>
<p><a href="${dashboardLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Complete Payment Setup</a></p>`;

  const { sendEmail } = await import("./email");
  await sendEmail({ to: user.email, subject, html });

  // SMS reminder
  if (user.phone) {
    const { sendSMS } = await import("./sms");
    await sendSMS(
      user.phone,
      `RoadSide ATL: Your payment setup is incomplete. Complete it here: ${dashboardLink}`,
    );
  }
}

export async function notifyPayoutComplete(
  providerId: string,
  amountCents: number,
) {
  const { db } = await import("@/db");
  const { providers } = await import("@/db/schema/providers");
  const { users } = await import("@/db/schema/users");
  const { eq } = await import("drizzle-orm");

  const provider = await db.query.providers.findFirst({ where: eq(providers.id, providerId) });
  if (!provider?.userId) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, provider.userId) });
  if (!user?.email) return;

  const dollars = (amountCents / 100).toFixed(2);

  const { sendEmail } = await import("./email");
  await sendEmail({
    to: user.email,
    subject: `Payout of $${dollars} sent to your account`,
    html: `<h2>Payout Sent!</h2><p>Hi ${escapeHtml(user.name || "Provider")},</p><p>A payout of <strong>$${dollars}</strong> has been sent to your connected Stripe account. Funds will be available in your bank account according to your Stripe payout schedule.</p>`,
  });

  if (user.phone) {
    const { sendSMS } = await import("./sms");
    await sendSMS(
      user.phone,
      `RoadSide ATL: A payout of $${dollars} has been sent to your account.`,
    );
  }
}

export async function notifyConnectDeadlineExpired(
  providerId: string,
) {
  const { db } = await import("@/db");
  const { providers } = await import("@/db/schema/providers");
  const { users } = await import("@/db/schema/users");
  const { eq } = await import("drizzle-orm");

  const provider = await db.query.providers.findFirst({ where: eq(providers.id, providerId) });
  if (!provider?.userId) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, provider.userId) });
  if (!user?.email) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com";
  const dashboardLink = `${appUrl}/provider/onboarding`;

  const { sendEmail } = await import("./email");
  await sendEmail({
    to: user.email,
    subject: "Account suspended — Complete Stripe Connect setup to reactivate",
    html: `<h2>Account Suspended</h2><p>Hi ${escapeHtml(user.name || "Provider")},</p><p>Your account has been suspended because you did not complete your Stripe Connect payment setup within the required deadline.</p><p>To reactivate your account and start receiving jobs again, please complete your payment setup:</p><p><a href="${dashboardLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Complete Payment Setup</a></p>`,
  });

  if (user.phone) {
    const { sendSMS } = await import("./sms");
    await sendSMS(
      user.phone,
      `RoadSide ATL: Your account has been suspended. Complete payment setup to reactivate: ${dashboardLink}`,
    );
  }
}

export async function notifyPaymentConfirmed(
  customer: { name: string; email: string; phone: string },
  bookingId: string,
  serviceName: string,
  amountPaid: number,
  paymentMethod: string,
  paymentDate: string,
  providerName?: string
) {
  await Promise.allSettled([
    sendPaymentReceiptEmail(
      customer.email,
      customer.name,
      bookingId,
      serviceName,
      amountPaid,
      paymentMethod,
      paymentDate,
      providerName
    ),
    sendPaymentReceiptSMS(customer.phone, bookingId, amountPaid, paymentMethod),
  ]);
}
