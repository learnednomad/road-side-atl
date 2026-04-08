import { describe, it, expect } from "vitest";
import {
  scoreAndRankCandidates,
  type CandidateInput,
} from "@/server/api/lib/dispatch-scorer";

function makeCandidate(overrides: Partial<CandidateInput> = {}): CandidateInput {
  return {
    providerId: "p1",
    name: "Provider 1",
    distanceMiles: 5,
    etaMinutes: 10,
    specialtyMatch: false,
    averageRating: 4.0,
    reviewCount: 10,
    activeJobCount: 0,
    weeklyEarningsCents: 50000,
    ...overrides,
  };
}

describe("scoreAndRankCandidates", () => {
  it("returns empty array for empty candidates", () => {
    expect(scoreAndRankCandidates([])).toEqual([]);
  });

  it("scores a single candidate with all factors", () => {
    const result = scoreAndRankCandidates([makeCandidate()]);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBeGreaterThan(0);
    expect(result[0].subscores).toHaveProperty("eta");
    expect(result[0].subscores).toHaveProperty("rating");
    expect(result[0].subscores).toHaveProperty("specialty");
    expect(result[0].subscores).toHaveProperty("workload");
    expect(result[0].subscores).toHaveProperty("fairness");
  });

  it("ranks lower ETA + higher rating above closer provider", () => {
    const farButFast = makeCandidate({
      providerId: "fast",
      name: "Fast",
      distanceMiles: 15,
      etaMinutes: 8,
      averageRating: 4.8,
    });
    const closeButSlow = makeCandidate({
      providerId: "slow",
      name: "Slow",
      distanceMiles: 3,
      etaMinutes: 25,
      averageRating: 3.2,
    });

    const result = scoreAndRankCandidates([closeButSlow, farButFast]);
    expect(result[0].providerId).toBe("fast");
  });

  it("filters out providers at max concurrent jobs", () => {
    const overloaded = makeCandidate({
      providerId: "overloaded",
      activeJobCount: 3,
    });
    const available = makeCandidate({
      providerId: "available",
      activeJobCount: 1,
    });

    const result = scoreAndRankCandidates([overloaded, available], undefined, 3);
    expect(result).toHaveLength(1);
    expect(result[0].providerId).toBe("available");
  });

  it("returns empty when all providers are at max jobs", () => {
    const c1 = makeCandidate({ providerId: "p1", activeJobCount: 3 });
    const c2 = makeCandidate({ providerId: "p2", activeJobCount: 4 });

    const result = scoreAndRankCandidates([c1, c2], undefined, 3);
    expect(result).toEqual([]);
  });

  it("gives specialty match higher score", () => {
    const withSpecialty = makeCandidate({
      providerId: "specialist",
      specialtyMatch: true,
      etaMinutes: 15,
    });
    const noSpecialty = makeCandidate({
      providerId: "generalist",
      specialtyMatch: false,
      etaMinutes: 15,
    });

    const result = scoreAndRankCandidates([noSpecialty, withSpecialty]);
    expect(result[0].providerId).toBe("specialist");
    expect(result[0].subscores.specialty).toBe(100);
    expect(result[1].subscores.specialty).toBe(0);
  });

  it("B2B mode doubles specialty weight", () => {
    const specialist = makeCandidate({
      providerId: "specialist",
      specialtyMatch: true,
      etaMinutes: 30, // far
    });
    const closer = makeCandidate({
      providerId: "closer",
      specialtyMatch: false,
      etaMinutes: 5, // close
    });

    // In normal mode, closer might win
    const normalResult = scoreAndRankCandidates([specialist, closer], undefined, 3, false);
    // In B2B mode, specialist should win due to doubled specialty weight
    const b2bResult = scoreAndRankCandidates([specialist, closer], undefined, 3, true);
    expect(b2bResult[0].providerId).toBe("specialist");
  });

  it("uses Bayesian default of 3.0 for unrated providers", () => {
    const rated = makeCandidate({
      providerId: "rated",
      averageRating: 4.5,
      reviewCount: 20,
    });
    const unrated = makeCandidate({
      providerId: "unrated",
      averageRating: null,
      reviewCount: 0,
    });

    const result = scoreAndRankCandidates([unrated, rated]);
    const unratedCandidate = result.find((c) => c.providerId === "unrated")!;
    // Bayesian default = 3.0 → (3.0/5)*100 = 60
    expect(unratedCandidate.subscores.rating).toBe(60);
  });

  it("custom weights override defaults", () => {
    const candidate = makeCandidate({ etaMinutes: 10, specialtyMatch: true });

    // Full weight on specialty
    const result = scoreAndRankCandidates(
      [candidate],
      { eta: 0, rating: 0, specialty: 1.0, workload: 0, fairness: 0 },
    );
    expect(result[0].score).toBe(100); // specialty score * 1.0 weight
  });

  it("workload score favors fewer active jobs", () => {
    const busy = makeCandidate({
      providerId: "busy",
      activeJobCount: 2,
      etaMinutes: 10,
      averageRating: 4.0,
    });
    const idle = makeCandidate({
      providerId: "idle",
      activeJobCount: 0,
      etaMinutes: 10,
      averageRating: 4.0,
    });

    const result = scoreAndRankCandidates([busy, idle]);
    const idleResult = result.find((c) => c.providerId === "idle")!;
    const busyResult = result.find((c) => c.providerId === "busy")!;
    expect(idleResult.subscores.workload).toBeGreaterThan(busyResult.subscores.workload);
  });

  it("fairness score favors lower-earning providers", () => {
    const highEarner = makeCandidate({
      providerId: "high",
      weeklyEarningsCents: 200000, // $2000
      etaMinutes: 10,
    });
    const lowEarner = makeCandidate({
      providerId: "low",
      weeklyEarningsCents: 20000, // $200
      etaMinutes: 10,
    });

    const result = scoreAndRankCandidates([highEarner, lowEarner]);
    const lowResult = result.find((c) => c.providerId === "low")!;
    const highResult = result.find((c) => c.providerId === "high")!;
    expect(lowResult.subscores.fairness).toBeGreaterThan(highResult.subscores.fairness);
  });

  it("handles all zero earnings gracefully", () => {
    const candidates = [
      makeCandidate({ providerId: "p1", weeklyEarningsCents: 0 }),
      makeCandidate({ providerId: "p2", weeklyEarningsCents: 0 }),
    ];

    const result = scoreAndRankCandidates(candidates);
    expect(result).toHaveLength(2);
    // Both should get neutral fairness (50)
    expect(result[0].subscores.fairness).toBe(50);
    expect(result[1].subscores.fairness).toBe(50);
  });

  it("ETA score handles extreme values correctly", () => {
    const veryFar = makeCandidate({ etaMinutes: 200 }); // beyond 120 cap
    const veryClose = makeCandidate({ providerId: "p2", etaMinutes: 1 });

    const result = scoreAndRankCandidates([veryFar, veryClose]);
    // Very far: clamped at 120 → 100 - 120*(100/120) = 0
    expect(result.find((c) => c.etaMinutes === 200)!.subscores.eta).toBe(0);
    // Very close: 100 - 1*(100/120) ≈ 99.17
    expect(result.find((c) => c.providerId === "p2")!.subscores.eta).toBeGreaterThan(99);
  });

  it("sorts candidates by score descending", () => {
    const candidates = [
      makeCandidate({ providerId: "bad", etaMinutes: 100, averageRating: 2.0 }),
      makeCandidate({ providerId: "good", etaMinutes: 5, averageRating: 5.0 }),
      makeCandidate({ providerId: "mid", etaMinutes: 30, averageRating: 3.5 }),
    ];

    const result = scoreAndRankCandidates(candidates);
    expect(result[0].providerId).toBe("good");
    expect(result[result.length - 1].providerId).toBe("bad");
    // Verify descending order
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });
});
