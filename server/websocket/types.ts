export type WSEvent =
  | { type: "booking:created"; data: { bookingId: string; contactName: string; status: string; serviceName: string } }
  | { type: "booking:status_changed"; data: { bookingId: string; status: string } }
  | { type: "provider:job_assigned"; data: { bookingId: string; providerId: string; contactName: string; address: string } }
  | { type: "provider:location_updated"; data: { providerId: string; lat: number; lng: number } }
  | { type: "auth"; data: { userId: string; role: string } }
  | { type: "pong"; data: Record<string, never> };
