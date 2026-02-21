const delayNotifiedBookings = new Set<string>();

export function markDelayNotified(bookingId: string): void {
  delayNotifiedBookings.add(bookingId);
}

export function hasDelayNotification(bookingId: string): boolean {
  return delayNotifiedBookings.has(bookingId);
}

export function clearDelayNotification(bookingId: string): void {
  delayNotifiedBookings.delete(bookingId);
}
