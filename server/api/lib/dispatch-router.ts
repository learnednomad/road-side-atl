/**
 * Dispatch Router — Feature-flag gate between V1 and V2 dispatch.
 *
 * When DISPATCH_OFFER_MODE=true: uses scored offer-based V2 dispatch.
 * When DISPATCH_OFFER_MODE=false (default): uses existing greedy V1 dispatch.
 *
 * All callers should use dispatchBooking() instead of importing V1/V2 directly.
 */

import { autoDispatchBooking } from "./auto-dispatch";
import { autoDispatchBookingV2, type DispatchV2Result } from "./auto-dispatch-v2";

interface DispatchResult {
  success: boolean;
  providerId?: string;
  providerName?: string;
  distanceMiles?: number;
  etaMinutes?: number;
  score?: number;
  expandedSearch?: boolean;
  attemptNumber?: number;
  reason?: string;
}

export function isOfferModeEnabled(): boolean {
  return process.env.DISPATCH_OFFER_MODE === "true";
}

/**
 * Route a dispatch request through V1 or V2 based on feature flag.
 *
 * @param bookingId The booking to dispatch
 * @param options.excludeProviderIds Providers to skip (from previous attempts)
 * @param options.attempt Cascade attempt number (V2 only, default 1)
 */
export async function dispatchBooking(
  bookingId: string,
  options?: { excludeProviderIds?: string[]; attempt?: number },
): Promise<DispatchResult> {
  if (isOfferModeEnabled()) {
    return autoDispatchBookingV2(bookingId, options);
  }

  // V1 path: only supports excludeProviderIds
  return autoDispatchBooking(bookingId, {
    excludeProviderIds: options?.excludeProviderIds,
  });
}
