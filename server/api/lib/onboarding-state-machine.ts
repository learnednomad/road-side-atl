/**
 * Onboarding State Machine — single source of truth for valid transitions.
 *
 * Provider status transitions match the Architecture State Transition Authority Matrix.
 * Step status transitions match the Architecture Step Status Transitions.
 */

// Provider status transitions
const PROVIDER_TRANSITIONS: Record<string, string[]> = {
  applied: ["onboarding"],
  onboarding: ["pending_review"],
  pending_review: ["active", "rejected"],
  rejected: ["applied"],
  active: ["suspended"],
  suspended: ["onboarding"],
};

// Step status transitions
const STEP_TRANSITIONS: Record<string, string[]> = {
  pending: ["draft", "in_progress"],
  draft: ["in_progress", "pending"],
  in_progress: ["pending_review", "complete"],
  pending_review: ["complete", "rejected"],
  rejected: ["draft", "pending"],
};

export function isValidProviderTransition(from: string, to: string): boolean {
  return PROVIDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidStepTransition(from: string, to: string): boolean {
  return STEP_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidProviderTransitions(from: string): string[] {
  return PROVIDER_TRANSITIONS[from] ?? [];
}

export function getValidStepTransitions(from: string): string[] {
  return STEP_TRANSITIONS[from] ?? [];
}
