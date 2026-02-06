import { sendBookingConfirmation, sendProviderAssignment, sendStatusUpdate } from "./email";
import {
  sendBookingConfirmationSMS,
  sendProviderAssignmentSMS,
  sendStatusUpdateSMS,
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
