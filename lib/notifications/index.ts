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
  const tasks: Promise<unknown>[] = [
    sendEmail({ to: user.email, subject, html }),
  ];

  // SMS on rejection — FR57: action required notification
  if (status === "rejected" && user.phone) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
    const dashboardLink = `${appUrl}/provider/onboarding`;
    const { sendSMS } = await import("./sms");
    tasks.push(
      sendSMS(
        user.phone,
        `RoadSide GA: Your ${documentType} was not approved. Reason: ${rejectionReason || "See dashboard"}. Please re-upload: ${dashboardLink}`,
      ),
    );
  }

  await Promise.allSettled(tasks);
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
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
      `RoadSide GA: Your payment setup is incomplete. Complete it here: ${dashboardLink}`,
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
      `RoadSide GA: A payout of $${dollars} has been sent to your account.`,
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
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
      `RoadSide GA: Your account has been suspended. Complete payment setup to reactivate: ${dashboardLink}`,
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

// --- Onboarding lifecycle notifications (Story 14-2) ---

export async function notifyProviderRejected(
  providerId: string,
  reason: string,
) {
  const { db } = await import("@/db");
  const { providers } = await import("@/db/schema/providers");
  const { users } = await import("@/db/schema/users");
  const { eq } = await import("drizzle-orm");

  const provider = await db.query.providers.findFirst({ where: eq(providers.id, providerId) });
  if (!provider?.userId) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, provider.userId) });
  if (!user?.email) return;

  const safeName = escapeHtml(user.name || "Provider");
  const safeReason = escapeHtml(reason);

  const { sendEmail } = await import("./email");
  const { sendPushNotification } = await import("./push");

  const tasks: Promise<unknown>[] = [
    sendEmail({
      to: user.email,
      subject: "RoadSide GA — Application update",
      html: `<h2>Application Update</h2><p>Hi ${safeName},</p><p>Unfortunately, your provider application was not approved at this time.</p><p><strong>Reason:</strong> ${safeReason}</p><p>If you believe this was in error or have questions, please contact our support team.</p>`,
    }),
    sendPushNotification(provider.userId!, {
      title: "Application Update",
      body: "Your provider application was not approved. Check your email for details.",
      url: "/provider/onboarding",
      tag: "onboarding-rejected",
    }),
  ];

  if (user.phone) {
    const { sendSMS } = await import("./sms");
    tasks.push(
      sendSMS(user.phone, `RoadSide GA: Your provider application was not approved. Reason: ${reason}. Contact support if you have questions.`),
    );
  }

  await Promise.allSettled(tasks);
}

export async function notifyApplicationReceived(
  userId: string,
  providerName: string,
  email: string,
  phone?: string,
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
  const dashboardLink = `${appUrl}/provider/onboarding`;

  const safeName = escapeHtml(providerName);

  const { sendEmail } = await import("./email");
  const { sendPushNotification } = await import("./push");

  const tasks: Promise<unknown>[] = [
    sendEmail({
      to: email,
      subject: "Application received — Welcome to RoadSide GA!",
      html: `<h2>Application Received!</h2><p>Hi ${safeName},</p><p>Thanks for applying to become a RoadSide GA provider. Your application has been received and your onboarding has started.</p><p>Complete your remaining onboarding steps to start getting jobs:</p><p><a href="${dashboardLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Go to Onboarding Dashboard</a></p>`,
    }),
    sendPushNotification(userId, {
      title: "Application Received!",
      body: "Welcome to RoadSide GA. Complete your onboarding to start getting jobs.",
      url: "/provider/onboarding",
      tag: "onboarding-application",
    }),
  ];

  if (phone) {
    const { sendSMS } = await import("./sms");
    tasks.push(
      sendSMS(
        phone,
        `RoadSide GA: Your provider application has been received! Complete your onboarding: ${dashboardLink}`,
      ),
    );
  }

  await Promise.allSettled(tasks);
}

export async function notifyTrainingCompleted(
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
  const dashboardLink = `${appUrl}/provider/onboarding`;
  const safeName = escapeHtml(user.name || "Provider");

  const { sendEmail } = await import("./email");
  const tasks: Promise<unknown>[] = [
    sendEmail({
      to: user.email,
      subject: "Training complete — Check your onboarding progress!",
      html: `<h2>Training Complete!</h2><p>Hi ${safeName},</p><p>You've completed all required training modules. Check your onboarding dashboard for remaining steps:</p><p><a href="${dashboardLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">View Dashboard</a></p>`,
    }),
  ];

  if (user.phone) {
    const { sendSMS } = await import("./sms");
    tasks.push(
      sendSMS(user.phone, `RoadSide GA: Training complete! Check your onboarding dashboard: ${dashboardLink}`),
    );
  }

  await Promise.allSettled(tasks);
}

export async function notifyStripeConnectCompleted(
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
  const dashboardLink = `${appUrl}/provider/onboarding`;
  const safeName = escapeHtml(user.name || "Provider");

  const { sendEmail } = await import("./email");
  const tasks: Promise<unknown>[] = [
    sendEmail({
      to: user.email,
      subject: "Payment setup complete!",
      html: `<h2>Payment Setup Complete!</h2><p>Hi ${safeName},</p><p>Your Stripe Connect account is set up and ready to receive payouts. Check your onboarding dashboard for remaining steps:</p><p><a href="${dashboardLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">View Dashboard</a></p>`,
    }),
  ];

  if (user.phone) {
    const { sendSMS } = await import("./sms");
    tasks.push(
      sendSMS(user.phone, `RoadSide GA: Payment setup complete! Check your onboarding dashboard: ${dashboardLink}`),
    );
  }

  await Promise.allSettled(tasks);
}

export async function notifyAdminProviderReadyForReview(
  providerId: string,
  providerName: string,
) {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema/users");
  const { eq } = await import("drizzle-orm");

  const admins = await db.query.users.findMany({
    where: eq(users.role, "admin"),
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
  const pipelineLink = `${appUrl}/admin/providers`;
  const safeName = escapeHtml(providerName);

  const { sendEmail } = await import("./email");
  await Promise.allSettled(
    admins
      .filter((admin) => admin.email)
      .map((admin) =>
        sendEmail({
          to: admin.email!,
          subject: `Provider ready for review: ${safeName}`,
          html: `<h2>Provider Ready for Final Review</h2><p><strong>${safeName}</strong> has completed all onboarding steps and is ready for activation.</p><p><a href="${pipelineLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Review in Pipeline</a></p>`,
        }),
      ),
  );
}

export async function notifyAdminNewDocumentSubmitted(
  providerId: string,
  providerName: string,
  documentType: string,
) {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema/users");
  const { eq } = await import("drizzle-orm");

  const admins = await db.query.users.findMany({
    where: eq(users.role, "admin"),
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
  const pipelineLink = `${appUrl}/admin/providers`;
  const safeName = escapeHtml(providerName);
  const safeDocType = escapeHtml(documentType);

  const { sendEmail } = await import("./email");
  await Promise.allSettled(
    admins
      .filter((admin) => admin.email)
      .map((admin) =>
        sendEmail({
          to: admin.email!,
          subject: `New document submitted: ${safeName} — ${safeDocType}`,
          html: `<h2>New Document for Review</h2><p><strong>${safeName}</strong> submitted a new <strong>${safeDocType}</strong> document for review.</p><p><a href="${pipelineLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Review Documents</a></p>`,
        }),
      ),
  );
}

// --- Migration notifications (Story 15-1) ---

async function migrationNotifyProvider(
  providerId: string,
  subject: string,
  htmlBody: string,
  smsMessage: string,
  pushTitle: string,
  pushBody: string,
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
  const { sendPushNotification } = await import("./push");

  const tasks: Promise<unknown>[] = [
    sendEmail({ to: user.email, subject, html: htmlBody }),
    sendPushNotification(provider.userId!, { title: pushTitle, body: pushBody, url: "/provider/onboarding", tag: "migration-reminder" }),
  ];

  if (user.phone) {
    const { sendSMS } = await import("./sms");
    tasks.push(sendSMS(user.phone, smsMessage));
  }

  await Promise.allSettled(tasks);
}

export async function notifyMigrationDay0(
  providerId: string,
  deadlineDate: string,
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
  const dashboardLink = `${appUrl}/provider/onboarding`;

  await migrationNotifyProvider(
    providerId,
    "Action required: New compliance requirements for RoadSide GA providers",
    `<h2>New Compliance Requirements</h2><p>Hi there,</p><p>RoadSide GA is upgrading provider compliance standards. You need to complete a few onboarding steps by <strong>${escapeHtml(deadlineDate)}</strong> to continue receiving jobs.</p><p><strong>What you need to do:</strong> Background check, insurance verification, certifications, training, and payment setup.</p><p><a href="${dashboardLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Complete Your Onboarding</a></p>`,
    `RoadSide GA: New compliance requirements. Complete by ${deadlineDate}. Start here: ${dashboardLink}`,
    "Action Required",
    `New compliance requirements. Complete by ${deadlineDate}.`,
  );
}

export async function notifyMigrationDay14(
  providerId: string,
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
  const dashboardLink = `${appUrl}/provider/onboarding`;

  await migrationNotifyProvider(
    providerId,
    "Reminder: 16 days remaining to complete compliance requirements",
    `<h2>16 Days Remaining</h2><p>Hi there,</p><p>You have <strong>16 days</strong> remaining to complete your compliance requirements. Don't lose access to jobs — finish your onboarding now.</p><p><a href="${dashboardLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Complete Your Onboarding</a></p>`,
    `RoadSide GA: 16 days remaining to complete compliance. Don't lose access: ${dashboardLink}`,
    "16 Days Remaining",
    "Complete your compliance requirements to keep receiving jobs.",
  );
}

export async function notifyMigrationDay25(
  providerId: string,
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
  const dashboardLink = `${appUrl}/provider/onboarding`;

  await migrationNotifyProvider(
    providerId,
    "URGENT: 5 days remaining — your account will be suspended",
    `<h2 style="color:#dc2626;">5 Days Remaining — Urgent</h2><p>Hi there,</p><p>You have only <strong>5 days</strong> left to complete your compliance requirements. <strong>Your account will be suspended</strong> if you don't finish by the deadline.</p><p>After suspension, you won't receive new jobs until you complete all steps.</p><p><a href="${dashboardLink}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;">Complete Now — 5 Days Left</a></p>`,
    `URGENT RoadSide GA: 5 days left! Your account will be suspended. Complete now: ${dashboardLink}`,
    "URGENT: 5 Days Left",
    "Your account will be suspended in 5 days. Complete your onboarding now.",
  );
}

export async function notifyMigrationSuspended(
  providerId: string,
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com";
  const dashboardLink = `${appUrl}/provider/onboarding`;

  await migrationNotifyProvider(
    providerId,
    "Account suspended — Complete compliance to reactivate",
    `<h2>Account Suspended</h2><p>Hi there,</p><p>Your provider account has been suspended because compliance requirements were not completed by the deadline.</p><p><strong>You can reactivate your account at any time</strong> by completing your remaining onboarding steps. Your earnings history and reviews are preserved.</p><p><a href="${dashboardLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Complete Onboarding to Reactivate</a></p>`,
    `RoadSide GA: Your account is suspended. Complete compliance to reactivate: ${dashboardLink}`,
    "Account Suspended",
    "Complete your onboarding steps to reactivate your account.",
  );
}
