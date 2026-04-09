/**
 * Auto-Dispatch V2 — Scored offer-based dispatch with cascade retries.
 *
 * Instead of instantly assigning the nearest provider (V1), this:
 * 1. Scores all eligible providers on ETA, rating, specialty, workload, fairness
 * 2. Sends an "offer" to the top-ranked provider (status=dispatched, offerExpiresAt set)
 * 3. Provider has 60s to accept; on timeout or rejection, cascades to next ranked
 * 4. After 3 failed attempts, marks booking as needing manual intervention
 *
 * Gated behind DISPATCH_OFFER_MODE=true environment variable.
 */

import { db } from "@/db";
import { bookings, providers, services, dispatchLogs, providerPayouts } from "@/db/schema";
import { eq, and, inArray, gte, sql } from "drizzle-orm";
import { calculateDistance, milesToMeters } from "@/lib/distance";
import { calculateEtaMinutes } from "@/server/api/lib/eta-calculator";
import { scoreAndRankCandidates, type CandidateInput } from "./dispatch-scorer";
import {
  DEFAULT_DISPATCH_RADIUS_MILES,
  EXPANDED_DISPATCH_RADIUS_MILES,
  DISPATCH_OFFER_TIMEOUT_MS,
  MAX_DISPATCH_CASCADE_ATTEMPTS,
  DEFAULT_SCORING_WEIGHTS,
} from "@/lib/constants";
import { notifyProviderAssigned } from "@/lib/notifications";
import { broadcastToProvider, broadcastToAdmins, broadcastToUser } from "@/server/websocket/broadcast";

const MAX_DISPATCH_DISTANCE_MILES = parseInt(
  process.env.MAX_DISPATCH_DISTANCE_MILES || String(DEFAULT_DISPATCH_RADIUS_MILES),
);
const EXPANDED_RADIUS = parseInt(
  process.env.MAX_EXPANDED_RADIUS_MILES || String(EXPANDED_DISPATCH_RADIUS_MILES),
);

export interface DispatchV2Result {
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

function getWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const diff = now.getDate() - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

export async function autoDispatchBookingV2(
  bookingId: string,
  options?: { excludeProviderIds?: string[]; attempt?: number },
): Promise<DispatchV2Result> {
  const attempt = options?.attempt ?? 1;
  const excludeIds = options?.excludeProviderIds ?? [];

  // 1. Load booking + service
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking) return { success: false, reason: "Booking not found" };

  const location = booking.location as {
    latitude?: number;
    longitude?: number;
    address: string;
  };

  if (!location.latitude || !location.longitude) {
    return { success: false, reason: "Booking has no coordinates" };
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });

  // 2. Query active + available providers
  const activeProviders = await db
    .select()
    .from(providers)
    .where(and(eq(providers.status, "active"), eq(providers.isAvailable, true)));

  const withCoords = activeProviders
    .filter((p) => p.latitude != null && p.longitude != null)
    .filter((p) => !excludeIds.includes(p.id));

  if (withCoords.length === 0) {
    const reason =
      excludeIds.length > 0
        ? `No remaining providers (${excludeIds.length} excluded)`
        : "No available providers";
    return { success: false, reason };
  }

  const providerIds = withCoords.map((p) => p.id);

  // 3. Batch query: active job counts per provider
  const jobCounts = await db
    .select({
      providerId: bookings.providerId,
      count: sql<number>`count(*)::int`,
    })
    .from(bookings)
    .where(
      and(
        inArray(bookings.providerId, providerIds),
        inArray(bookings.status, ["dispatched", "in_progress"]),
      ),
    )
    .groupBy(bookings.providerId);

  const jobCountMap = new Map(jobCounts.map((r) => [r.providerId, r.count]));

  // 4. Batch query: weekly earnings per provider
  const weekStart = getWeekStart();
  const earningsData = await db
    .select({
      providerId: providerPayouts.providerId,
      total: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)::int`,
    })
    .from(providerPayouts)
    .where(
      and(
        inArray(providerPayouts.providerId, providerIds),
        gte(providerPayouts.createdAt, weekStart),
      ),
    )
    .groupBy(providerPayouts.providerId);

  const earningsMap = new Map(earningsData.map((r) => [r.providerId, r.total]));

  // 5. Build candidate inputs + score
  const isB2B = booking.tenantId != null;

  function buildScoredCandidates(maxDistance: number) {
    const candidateInputs: CandidateInput[] = withCoords
      .map((p) => {
        const distanceMiles = calculateDistance(
          { latitude: location.latitude!, longitude: location.longitude! },
          { latitude: p.latitude!, longitude: p.longitude! },
        );
        const etaMinutes = calculateEtaMinutes(
          p.latitude!,
          p.longitude!,
          location.latitude!,
          location.longitude!,
        );
        const specialties = (p.specialties as string[]) || [];
        return {
          providerId: p.id,
          name: p.name,
          distanceMiles: Math.round(distanceMiles * 10) / 10,
          etaMinutes,
          specialtyMatch: service ? specialties.includes(service.category) : false,
          averageRating: p.averageRating,
          reviewCount: p.reviewCount,
          activeJobCount: jobCountMap.get(p.id) ?? 0,
          weeklyEarningsCents: earningsMap.get(p.id) ?? 0,
        };
      })
      .filter((c) => c.distanceMiles <= maxDistance);

    return scoreAndRankCandidates(candidateInputs, undefined, undefined, isB2B);
  }

  let scored = buildScoredCandidates(MAX_DISPATCH_DISTANCE_MILES);
  let expandedSearch = false;

  if (scored.length === 0) {
    scored = buildScoredCandidates(EXPANDED_RADIUS);
    if (scored.length > 0) expandedSearch = true;
  }

  // 6. No candidates left
  if (scored.length === 0) {
    if (attempt >= MAX_DISPATCH_CASCADE_ATTEMPTS) {
      await db.insert(dispatchLogs).values({
        bookingId,
        algorithm: "auto",
        candidateProviders: [],
        reason: `All ${MAX_DISPATCH_CASCADE_ATTEMPTS} dispatch attempts exhausted — no eligible providers`,
        attemptNumber: attempt,
        outcome: "expired",
      });
      broadcastToAdmins({
        type: "booking:dispatch_failed",
        data: { bookingId, reason: `All ${MAX_DISPATCH_CASCADE_ATTEMPTS} attempts exhausted` },
      });
      return {
        success: false,
        attemptNumber: attempt,
        reason: `All ${MAX_DISPATCH_CASCADE_ATTEMPTS} dispatch attempts exhausted`,
      };
    }

    const reason =
      excludeIds.length > 0
        ? `No remaining providers within range (attempt ${attempt}, ${excludeIds.length} excluded)`
        : "No providers within range";
    await db.insert(dispatchLogs).values({
      bookingId,
      algorithm: "auto",
      candidateProviders: [],
      reason,
      attemptNumber: attempt,
    });
    return { success: false, reason, attemptNumber: attempt };
  }

  // 7. Pick top-ranked candidate and make offer
  const best = scored[0];
  const assignedProvider = withCoords.find((p) => p.id === best.providerId)!;
  const offerExpiresAt = new Date(Date.now() + DISPATCH_OFFER_TIMEOUT_MS);

  await db
    .update(bookings)
    .set({
      providerId: best.providerId,
      status: "dispatched",
      offerExpiresAt,
      dispatchAttempt: attempt,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));

  // 8. Log dispatch with scoring metadata
  const dispatchReason = [
    `Offered to ${best.name} (${best.distanceMiles}mi, ETA ${best.etaMinutes}min, score ${best.score})`,
    expandedSearch ? "(expanded radius)" : null,
    isB2B ? "(B2B priority)" : null,
    attempt > 1 ? `(cascade attempt ${attempt})` : null,
  ]
    .filter(Boolean)
    .join(" ");

  await db.insert(dispatchLogs).values({
    bookingId,
    assignedProviderId: best.providerId,
    algorithm: "auto",
    distanceMeters: milesToMeters(best.distanceMiles),
    candidateProviders: scored.map((s) => ({
      providerId: s.providerId,
      name: s.name,
      distanceMiles: s.distanceMiles,
      specialtyMatch: s.specialtyMatch,
      score: s.score,
    })),
    reason: dispatchReason,
    score: best.score,
    attemptNumber: attempt,
    scoringWeights: { ...DEFAULT_SCORING_WEIGHTS },
  });

  // 9. Calculate payout + send notifications (same pattern as V1)
  const estimatedPrice = booking.estimatedPrice || 0;
  let estimatedPayout = 0;
  if (assignedProvider.commissionType === "flat_per_job") {
    estimatedPayout = assignedProvider.flatFeeAmount || 0;
  } else if (service && service.commissionRate > 0) {
    const platformCut = Math.round((estimatedPrice * service.commissionRate) / 10000);
    estimatedPayout = estimatedPrice - platformCut;
  } else {
    estimatedPayout = Math.round((estimatedPrice * assignedProvider.commissionRate) / 10000);
  }

  notifyProviderAssigned(booking, assignedProvider, estimatedPrice, estimatedPayout, service?.name).catch(
    () => {},
  );

  if (assignedProvider.userId) {
    broadcastToProvider(assignedProvider.userId, {
      type: "provider:job_assigned",
      data: {
        bookingId,
        providerId: assignedProvider.id,
        contactName: booking.contactName,
        address: location.address,
        serviceName: service?.name,
        estimatedPrice,
        estimatedPayout,
        offerExpiresAt: offerExpiresAt.toISOString(),
        etaMinutes: best.etaMinutes,
      },
    });
  }

  broadcastToAdmins({
    type: "booking:status_changed",
    data: { bookingId, status: "dispatched" },
  });
  if (booking.userId) {
    broadcastToUser(booking.userId, {
      type: "booking:status_changed",
      data: { bookingId, status: "dispatched" },
    });
  }

  return {
    success: true,
    providerId: best.providerId,
    providerName: best.name,
    distanceMiles: best.distanceMiles,
    etaMinutes: best.etaMinutes,
    score: best.score,
    expandedSearch,
    attemptNumber: attempt,
  };
}
