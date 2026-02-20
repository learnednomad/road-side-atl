export type WSEvent =
  | { type: "booking:created"; data: { bookingId: string; contactName: string; status: string; serviceName: string; b2bAccountId?: string } }
  | { type: "booking:status_changed"; data: { bookingId: string; status: string } }
  | { type: "provider:job_assigned"; data: { bookingId: string; providerId: string; contactName: string; address: string; serviceName?: string; estimatedPrice?: number; estimatedPayout?: number } }
  | { type: "provider:location_updated"; data: { providerId: string; lat: number; lng: number; etaMinutes?: number } }
  | { type: "auth"; data: { userId: string; role: string } }
  | { type: "pong"; data: Record<string, never> }
  | { type: "storm_mode:activated"; data: { templateName: string; multiplier: number; activatedBy: string } }
  | { type: "storm_mode:deactivated"; data: { deactivatedBy: string } }
  | { type: "booking:price_override"; data: { bookingId: string } }
  | { type: "service:commission_updated"; data: { serviceId: string; commissionRate: number } }
  | { type: "payout:batch_paid"; data: { payoutIds: string[]; count: number } }
  | { type: "payment:refunded"; data: { paymentId: string; bookingId: string; refundType: string; refundAmount: number } };
