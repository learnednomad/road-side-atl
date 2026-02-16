import { sendBookingConfirmation, sendProviderAssignment, sendStatusUpdate, sendObservationFollowUpEmail, sendReferralCreditEmail, sendPreServiceConfirmationEmail, sendInspectionReportEmail, sendTierPromotionEmail } from "./email";
import {
  sendBookingConfirmationSMS,
  sendProviderAssignmentSMS,
  sendStatusUpdateSMS,
  sendObservationFollowUpSMS,
  sendPreServiceConfirmationSMS,
  sendReferralSMS,
  sendReferralCreditSMS,
  sendTierPromotionSMS,
} from "./sms";

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

export async function notifyBookingCreated(booking: BookingInfo) {
  await Promise.allSettled([
    sendBookingConfirmation(booking),
    sendBookingConfirmationSMS(booking.contactPhone, booking),
  ]);
}

export async function notifyProviderAssigned(booking: BookingInfo, provider: ProviderInfo) {
  await Promise.allSettled([
    sendProviderAssignment(booking, provider),
    sendProviderAssignmentSMS(provider.phone, booking),
  ]);
}

export async function notifyStatusChange(booking: BookingInfo, newStatus: string) {
  await Promise.allSettled([
    sendStatusUpdate(booking, newStatus),
    sendStatusUpdateSMS(booking.contactPhone, booking, newStatus),
  ]);
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
  reportUrl: string
) {
  await sendInspectionReportEmail(customer.email, customer.name, bookingId, vehicleDescription, reportUrl);
}
