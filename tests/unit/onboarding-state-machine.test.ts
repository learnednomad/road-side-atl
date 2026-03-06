import { describe, expect, it } from "vitest";
import {
  isValidProviderTransition,
  isValidStepTransition,
  getValidProviderTransitions,
  getValidStepTransitions,
} from "@/server/api/lib/onboarding-state-machine";

describe("Onboarding State Machine", () => {
  describe("isValidProviderTransition", () => {
    // Valid transitions
    it("applied → onboarding returns true", () => {
      expect(isValidProviderTransition("applied", "onboarding")).toBe(true);
    });

    it("onboarding → pending_review returns true", () => {
      expect(isValidProviderTransition("onboarding", "pending_review")).toBe(true);
    });

    it("pending_review → active returns true", () => {
      expect(isValidProviderTransition("pending_review", "active")).toBe(true);
    });

    it("pending_review → rejected returns true", () => {
      expect(isValidProviderTransition("pending_review", "rejected")).toBe(true);
    });

    it("active → suspended returns true", () => {
      expect(isValidProviderTransition("active", "suspended")).toBe(true);
    });

    it("suspended → onboarding returns true", () => {
      expect(isValidProviderTransition("suspended", "onboarding")).toBe(true);
    });

    it("rejected → applied returns true", () => {
      expect(isValidProviderTransition("rejected", "applied")).toBe(true);
    });

    // Invalid transitions
    it("onboarding → active returns false (skip pending_review)", () => {
      expect(isValidProviderTransition("onboarding", "active")).toBe(false);
    });

    it("active → pending_review returns false (no backward)", () => {
      expect(isValidProviderTransition("active", "pending_review")).toBe(false);
    });

    it("active → rejected returns false (must suspend first)", () => {
      expect(isValidProviderTransition("active", "rejected")).toBe(false);
    });

    it("applied → active returns false", () => {
      expect(isValidProviderTransition("applied", "active")).toBe(false);
    });

    it("unknown status returns false", () => {
      expect(isValidProviderTransition("nonexistent", "active")).toBe(false);
    });
  });

  describe("isValidStepTransition", () => {
    // Valid transitions
    it("pending → draft returns true", () => {
      expect(isValidStepTransition("pending", "draft")).toBe(true);
    });

    it("pending → in_progress returns true", () => {
      expect(isValidStepTransition("pending", "in_progress")).toBe(true);
    });

    it("draft → in_progress returns true", () => {
      expect(isValidStepTransition("draft", "in_progress")).toBe(true);
    });

    it("draft → pending returns true", () => {
      expect(isValidStepTransition("draft", "pending")).toBe(true);
    });

    it("in_progress → pending_review returns true", () => {
      expect(isValidStepTransition("in_progress", "pending_review")).toBe(true);
    });

    it("in_progress → complete returns true", () => {
      expect(isValidStepTransition("in_progress", "complete")).toBe(true);
    });

    it("pending_review → complete returns true", () => {
      expect(isValidStepTransition("pending_review", "complete")).toBe(true);
    });

    it("pending_review → rejected returns true", () => {
      expect(isValidStepTransition("pending_review", "rejected")).toBe(true);
    });

    it("rejected → draft returns true", () => {
      expect(isValidStepTransition("rejected", "draft")).toBe(true);
    });

    it("rejected → pending returns true", () => {
      expect(isValidStepTransition("rejected", "pending")).toBe(true);
    });

    // Invalid transitions
    it("pending → complete returns false (skip review)", () => {
      expect(isValidStepTransition("pending", "complete")).toBe(false);
    });

    it("complete → rejected returns false (no backward from complete)", () => {
      expect(isValidStepTransition("complete", "rejected")).toBe(false);
    });

    it("complete → anything returns false (terminal state)", () => {
      expect(isValidStepTransition("complete", "pending")).toBe(false);
      expect(isValidStepTransition("complete", "draft")).toBe(false);
      expect(isValidStepTransition("complete", "in_progress")).toBe(false);
    });

    it("unknown status returns false", () => {
      expect(isValidStepTransition("nonexistent", "draft")).toBe(false);
    });
  });

  describe("getValidProviderTransitions", () => {
    it("returns correct options for applied", () => {
      expect(getValidProviderTransitions("applied")).toEqual(["onboarding"]);
    });

    it("returns correct options for pending_review", () => {
      expect(getValidProviderTransitions("pending_review")).toEqual(["active", "rejected"]);
    });

    it("returns correct options for active", () => {
      expect(getValidProviderTransitions("active")).toEqual(["suspended"]);
    });

    it("returns correct options for suspended", () => {
      expect(getValidProviderTransitions("suspended")).toEqual(["onboarding"]);
    });

    it("returns correct options for rejected", () => {
      expect(getValidProviderTransitions("rejected")).toEqual(["applied"]);
    });

    it("returns empty array for unknown status", () => {
      expect(getValidProviderTransitions("nonexistent")).toEqual([]);
    });
  });

  describe("getValidStepTransitions", () => {
    it("returns correct options for pending", () => {
      expect(getValidStepTransitions("pending")).toEqual(["draft", "in_progress"]);
    });

    it("returns correct options for draft", () => {
      expect(getValidStepTransitions("draft")).toEqual(["in_progress", "pending"]);
    });

    it("returns correct options for in_progress", () => {
      expect(getValidStepTransitions("in_progress")).toEqual(["pending_review", "complete"]);
    });

    it("returns correct options for pending_review", () => {
      expect(getValidStepTransitions("pending_review")).toEqual(["complete", "rejected"]);
    });

    it("returns correct options for rejected", () => {
      expect(getValidStepTransitions("rejected")).toEqual(["draft", "pending"]);
    });

    it("returns empty array for complete (terminal)", () => {
      expect(getValidStepTransitions("complete")).toEqual([]);
    });

    it("returns empty array for unknown status", () => {
      expect(getValidStepTransitions("nonexistent")).toEqual([]);
    });
  });
});
