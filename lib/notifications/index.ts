import { sendBookingConfirmation, sendProviderAssignment, sendStatusUpdate, sendObservationFollowUpEmail, sendInspectionReportEmail } from "./email";
import {
  sendBookingConfirmationSMS,
  sendProviderAssignmentSMS,
  sendStatusUpdateSMS,
  sendObservationFollowUpSMS,
  sendReferralSMS,
  sendReferralCreditSMS,
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

export async function notifyReferralCredit(phone: string, amount: number) {
  await sendReferralCreditSMS(phone, amount);
}

export async function notifyInspectionReport(
  customer: { name: string; email: string },
  bookingId: string,
  vehicleDescription: string,
  reportUrl: string
) {
  await sendInspectionReportEmail(customer.email, customer.name, bookingId, vehicleDescription, reportUrl);
}
