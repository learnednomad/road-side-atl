/**
 * Dispatch Scorer — Pure scoring engine for V2 dispatch.
 *
 * No database access, no side effects. All data passed in by caller.
 * Produces a ranked list of scored candidates for dispatch offer.
 */

import {
  DEFAULT_SCORING_WEIGHTS,
  MAX_CONCURRENT_JOBS_PER_PROVIDER,
  type ScoringWeights,
} from "@/lib/constants";

export interface CandidateInput {
  providerId: string;
  name: string;
  distanceMiles: number;
  etaMinutes: number;
  specialtyMatch: boolean;
  averageRating: number | null;
  reviewCount: number;
  activeJobCount: number;
  weeklyEarningsCents: number;
}

export interface ScoredCandidate extends CandidateInput {
  score: number; // 0-100, higher = better match
  subscores: {
    eta: number;
    rating: number;
    specialty: number;
    workload: number;
    fairness: number;
  };
}

type Weights = ScoringWeights;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Score and rank dispatch candidates.
 *
 * @param candidates Raw candidate data (distance, rating, workload, etc.)
 * @param weights Override default scoring weights (all must sum to ~1.0)
 * @param maxConcurrentJobs Providers at or above this are filtered out (default: 3)
 * @param isB2B If true, doubles specialty weight and halves ETA weight
 * @returns Candidates sorted by score descending (best first), with overloaded providers removed
 */
export function scoreAndRankCandidates(
  candidates: CandidateInput[],
  weights?: Partial<Weights>,
  maxConcurrentJobs: number = MAX_CONCURRENT_JOBS_PER_PROVIDER,
  isB2B: boolean = false,
): ScoredCandidate[] {
  if (candidates.length === 0) return [];

  const w = { ...DEFAULT_SCORING_WEIGHTS, ...weights };

  // B2B: double specialty weight, halve ETA weight
  if (isB2B) {
    const etaReduction = w.specialty; // take specialty's current value
    w.specialty = w.specialty * 2;
    w.eta = Math.max(0.05, w.eta - etaReduction);
  }

  // Filter out providers at or above max concurrent jobs
  const eligible = candidates.filter((c) => c.activeJobCount < maxConcurrentJobs);
  if (eligible.length === 0) return [];

  // Compute median weekly earnings for fairness scoring
  const earningsSorted = [...eligible]
    .map((c) => c.weeklyEarningsCents)
    .sort((a, b) => a - b);
  const medianEarnings =
    earningsSorted.length % 2 === 0
      ? (earningsSorted[earningsSorted.length / 2 - 1] + earningsSorted[earningsSorted.length / 2]) / 2
      : earningsSorted[Math.floor(earningsSorted.length / 2)];

  return eligible
    .map((c) => {
      // ETA: lower is better → higher score. Cap at 120min.
      const etaScore = 100 - clamp(c.etaMinutes, 0, 120) * (100 / 120);

      // Rating: higher is better. Bayesian default of 3.0 for unrated.
      const effectiveRating = c.averageRating ?? 3.0;
      const ratingScore = (clamp(effectiveRating, 0, 5) / 5) * 100;

      // Specialty: binary match
      const specialtyScore = c.specialtyMatch ? 100 : 0;

      // Workload: fewer active jobs = higher score
      const workloadScore = 100 - (c.activeJobCount / maxConcurrentJobs) * 100;

      // Fairness: providers earning less than median get a boost
      let fairnessScore: number;
      if (medianEarnings <= 0) {
        fairnessScore = 50; // no earnings data yet — neutral
      } else {
        const ratio = c.weeklyEarningsCents / medianEarnings;
        // ratio < 1 means under-earning → higher fairness score
        // ratio > 1 means over-earning → lower fairness score
        fairnessScore = clamp(100 - ratio * 50, 0, 100);
      }

      const score =
        w.eta * etaScore +
        w.rating * ratingScore +
        w.specialty * specialtyScore +
        w.workload * workloadScore +
        w.fairness * fairnessScore;

      return {
        ...c,
        score: Math.round(score * 100) / 100,
        subscores: {
          eta: Math.round(etaScore * 100) / 100,
          rating: Math.round(ratingScore * 100) / 100,
          specialty: Math.round(specialtyScore * 100) / 100,
          workload: Math.round(workloadScore * 100) / 100,
          fairness: Math.round(fairnessScore * 100) / 100,
        },
      };
    })
    .sort((a, b) => b.score - a.score); // descending: highest score first
}
