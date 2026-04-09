export type WSEvent =
  | { type: "booking:created"; data: { bookingId: string; contactName: string; status: string; serviceName: string; b2bAccountId?: string } }
  | { type: "booking:status_changed"; data: { bookingId: string; status: string } }
  | { type: "booking:rescheduled"; data: { bookingId: string; scheduledAt?: string } }
  | { type: "provider:job_assigned"; data: { bookingId: string; providerId: string; contactName: string; address: string; serviceName?: string; estimatedPrice?: number; estimatedPayout?: number; offerExpiresAt?: string; etaMinutes?: number } }
  | { type: "provider:offer_expired"; data: { bookingId: string; reason: string } }
  | { type: "booking:offer_expired"; data: { bookingId: string; attemptNumber: number; providerId: string } }
  | { type: "provider:location_updated"; data: { providerId: string; lat: number; lng: number; etaMinutes?: number } }
  | { type: "auth"; data: { userId: string; role: string } }
  | { type: "pong"; data: Record<string, never> }
  | { type: "storm_mode:activated"; data: { templateName: string; multiplier: number; activatedBy: string } }
  | { type: "storm_mode:deactivated"; data: { deactivatedBy: string } }
  | { type: "booking:price_override"; data: { bookingId: string } }
  | { type: "service:commission_updated"; data: { serviceId: string; commissionRate: number } }
  | { type: "payout:batch_paid"; data: { payoutIds: string[]; count: number } }
  | { type: "payout:transfer_failed"; data: { payoutId: string; stripeTransferId: string } }
  | { type: "payment:refunded"; data: { paymentId: string; bookingId: string; refundType: string; refundAmount: number } }
  | { type: "booking:dispatch_failed"; data: { bookingId: string; reason?: string } }
  | { type: "onboarding:ready_for_review"; data: { providerId: string; providerName: string } }
  | { type: "onboarding:step_updated"; data: { providerId: string; stepType: string; newStatus: string } }
  | { type: "onboarding:new_submission"; data: { providerId: string; providerName: string; stepType: string } };
