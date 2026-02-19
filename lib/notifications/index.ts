import { sendBookingConfirmation, sendProviderAssignment, sendStatusUpdate, sendObservationFollowUpEmail, sendReferralCreditEmail, sendPreServiceConfirmationEmail, sendInspectionReportEmail, sendTierPromotionEmail, sendPaymentReceiptEmail } from "./email";
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
