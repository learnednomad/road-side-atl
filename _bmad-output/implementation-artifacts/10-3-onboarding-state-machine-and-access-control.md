# Story 10.3: Onboarding State Machine and Access Control

Status: complete

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin managing provider onboarding,
I want the system to enforce valid state transitions for providers and onboarding steps, with admin endpoints to activate, reject, suspend, and reinstate providers, and step-level review capabilities,
so that the onboarding pipeline has deterministic, auditable transitions with no invalid states, and providers can reapply after rejection.

## Acceptance Criteria

1. **Given** a provider with status `pending_review`, **When** an admin calls `POST /api/admin/providers/:id/activate`, **Then** the provider status transitions to `active`, `activatedAt` is set to the current timestamp, `logAudit("onboarding.activated")` is recorded with the admin's userId, a `onboarding:activated` WebSocket event is broadcast with `{ providerId, providerName }`, **And** a fire-and-forget activation notification is sent to the provider.

2. **Given** a provider with status `pending_review`, **When** an admin calls `POST /api/admin/providers/:id/reject` with a `reason` field, **Then** the provider status transitions to `rejected`, `logAudit("onboarding.rejected")` is recorded with the admin's userId and the rejection reason, **And** the rejection reason is persisted (via `suspendedReason` column reused for rejection context).

3. **Given** a provider with status `pending_review`, **When** an admin calls `POST /api/admin/providers/:id/reject` without a `reason` field, **Then** the request is rejected with a 400 validation error — reason is required.

4. **Given** a provider with status `active`, **When** an admin calls `POST /api/admin/providers/:id/suspend` with a `reason`, **Then** the provider status transitions to `suspended`, `suspendedAt` is set, `suspendedReason` is stored, `logAudit("onboarding.suspended")` is recorded, **And** the `requireOnboardingComplete` middleware immediately blocks this provider from dispatch-gated routes on next request.

5. **Given** a provider with status `suspended`, **When** an admin calls `POST /api/admin/providers/:id/reinstate`, **Then** the provider status transitions to `onboarding`, `suspendedAt` and `suspendedReason` are cleared, any previously `rejected` onboarding steps are reset to `pending`, a new set of onboarding steps is NOT created (existing steps are preserved), `logAudit("onboarding.status_changed")` is recorded, **And** the provider can access the onboarding dashboard to re-complete failed steps.

6. **Given** a provider with status `rejected`, **When** the provider calls `POST /api/onboarding/reapply`, **Then** a cool-down period of 30 days from the rejection date is enforced (if within cool-down, return 400 with "Reapply available after {date}"), the provider status transitions to `applied`, `previousApplicationId` is set to the current provider ID for audit trail, all onboarding steps are reset to `pending` (background_check set to `in_progress` with fresh Checkr metadata), `logAudit("onboarding.status_changed")` is recorded, **And** the provider is redirected to the onboarding dashboard.

7. **Given** an admin calls `PATCH /api/admin/providers/:id/steps/:stepId` with `{ status: "complete" }`, **When** the step's current status is `pending_review`, **Then** the step status transitions to `complete`, `completedAt` is set, `reviewedBy` is set to admin's userId, `reviewedAt` is set, `logAudit("onboarding.step_completed")` is recorded, a `onboarding:step_updated` WebSocket event is broadcast, **And** the dashboard auto-transition check runs (if all steps now complete, provider transitions to `pending_review`).

8. **Given** an admin calls `PATCH /api/admin/providers/:id/steps/:stepId` with `{ status: "rejected", rejectionReason: "..." }`, **When** the step's current status is `pending_review`, **Then** the step status transitions to `rejected`, `rejectionReason` is stored, `reviewedBy` and `reviewedAt` are set, `logAudit("onboarding.step_rejected")` is recorded, **And** a `onboarding:step_updated` WebSocket event is broadcast.

9. **Given** any admin endpoint attempts to transition a provider to an invalid status (e.g., `active → pending_review`, or `onboarding → active`), **When** the transition is validated against the state machine, **Then** the request is rejected with a 400 error: `"Invalid transition: {currentStatus} -> {targetStatus}"`, **And** no database change occurs.

10. **Given** any admin endpoint attempts to transition a step to an invalid status (e.g., `pending → complete`, or `complete → rejected`), **When** the step transition is validated against the step state machine, **Then** the request is rejected with a 400 error: `"Invalid step transition: {currentStatus} -> {targetStatus}"`, **And** no database change occurs.

11. **Given** the state transition validation module, **When** called with any (currentStatus, targetStatus) pair, **Then** it returns `true` only for transitions defined in the architecture's State Transition Authority Matrix and Step Status Transitions, **And** all other combinations return `false`.

12. **Given** a provider step update endpoint, **When** a provider calls `PATCH /api/onboarding/steps/:stepId` with `{ status: "draft", draftData: {...} }`, **Then** the step transitions from `pending` to `draft` (or updates existing `draft` data), `draftData` JSONB is persisted, `logAudit("onboarding.step_started")` is recorded for first draft save, **And** this endpoint is gated by `requireProvider` only (not `requireOnboardingComplete`).

## Tasks / Subtasks

- [x] Task 1: Create state machine transition validation module (AC: 9, 10, 11)
  - [x] 1.1 Create `server/api/lib/onboarding-state-machine.ts` — export `isValidProviderTransition(from, to): boolean` and `isValidStepTransition(from, to): boolean`
  - [x] 1.2 Define provider status transitions map matching architecture's State Transition Authority Matrix
  - [x] 1.3 Define step status transitions map matching architecture's Step Status Transitions
  - [x] 1.4 Export `getValidProviderTransitions(from): string[]` and `getValidStepTransitions(from): string[]` for UI consumption

- [x] Task 2: Add admin provider status transition endpoints (AC: 1, 2, 3, 4, 5, 9)
  - [x] 2.1 Add `POST /:id/activate` — validates `pending_review → active`, sets `activatedAt`, logs audit, broadcasts WebSocket, sends email notification
  - [x] 2.2 Add `POST /:id/reject` — validates `pending_review → rejected`, requires `reason`, stores in `suspendedReason`, logs audit
  - [x] 2.3 Add `POST /:id/suspend` — validates `active → suspended`, requires `reason`, sets `suspendedAt` + `suspendedReason`, logs audit
  - [x] 2.4 Add `POST /:id/reinstate` — validates `suspended → onboarding`, clears suspension fields, resets `rejected` steps via transaction, logs audit

- [x] Task 3: Add admin step review endpoint (AC: 7, 8, 10)
  - [x] 3.1 Add `PATCH /:id/steps/:stepId` — validates step ownership + transition, applies review fields
  - [x] 3.2 Auto-transition check: if all steps complete + provider in `onboarding` → `pending_review` with TOCTOU WHERE clause
  - [x] 3.3 Broadcast `onboarding:step_updated` WebSocket event
  - [x] 3.4 Log `onboarding.step_completed` or `onboarding.step_rejected` audit events

- [x] Task 4: Add provider reapply endpoint (AC: 6)
  - [x] 4.1 Add `POST /reapply` to `onboarding.ts` with `requireProvider` middleware
  - [x] 4.2 Enforce 30-day cool-down via provider `updatedAt`
  - [x] 4.3 Transition `rejected → applied`, set `previousApplicationId`
  - [x] 4.4 Reset all steps to `pending`, background_check to `in_progress` with fresh Checkr metadata
  - [x] 4.5 Immediately transition to `onboarding` (mirrors initial application flow)
  - [x] 4.6 Log audit events for status changes

- [x] Task 5: Add provider step update endpoint (AC: 12)
  - [x] 5.1 Add `PATCH /steps/:stepId` to `onboarding.ts` with `requireProvider`
  - [x] 5.2 Validate step belongs to the authenticated provider
  - [x] 5.3 Validate step transition is legal using `isValidStepTransition()`
  - [x] 5.4 For `draft` status: persist `draftData` JSONB, log `onboarding.step_started` on first draft save
  - [x] 5.5 For `in_progress` status: provider submitting for review/processing

- [x] Task 6: Add Zod validators for new endpoints (AC: 1-12)
  - [x] 6.1 Add `adminRejectProviderSchema` — `{ reason: z.string().min(1) }`
  - [x] 6.2 Add `adminSuspendProviderSchema` — `{ reason: z.string().min(1) }`
  - [x] 6.3 Add `adminReviewStepSchema` — with `.refine()` for conditional rejectionReason
  - [x] 6.4 Add `providerStepUpdateSchema` — `{ status, draftData }`

- [x] Task 7: Add reapply cool-down constant (AC: 6)
  - [x] 7.1 Add `REAPPLY_COOLDOWN_DAYS = 30` to `lib/constants.ts`

- [x] Task 8: Write tests (AC: 1-12)
  - [x] 8.1 Unit tests for state machine module: 39 tests — all valid/invalid provider+step transitions + getters
  - [x] 8.2 Unit tests for admin endpoints: activate (success + TOCTOU + invalid + 404), reject (success + missing reason + invalid), suspend (success + invalid), reinstate (success + step reset + invalid)
  - [x] 8.3 Unit tests for step review endpoint: approve + reject + auto-transition + invalid transition + 404
  - [x] 8.4 Unit tests for provider reapply: success + cool-down + invalid transition + 404 + 401
  - [x] 8.5 Unit tests for provider step update: draft save + invalid transition + ownership + 401 + invalid status

## Dev Notes

### Technical Requirements

**State Machine Module — `server/api/lib/onboarding-state-machine.ts`:**
```typescript
// Provider status transitions — matches Architecture State Transition Authority Matrix
const PROVIDER_TRANSITIONS: Record<string, string[]> = {
  applied: ["onboarding"],
  onboarding: ["pending_review"],
  pending_review: ["active", "rejected"],
  rejected: ["applied"],
  active: ["suspended"],
  suspended: ["onboarding"],
};

// Step status transitions — matches Architecture Step Status Transitions
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
```

**Admin Activate Endpoint — `POST /:id/activate`:**
```typescript
// In server/api/routes/admin-providers.ts
app.post("/:id/activate", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);
  if (!isValidProviderTransition(provider.status, "active")) {
    return c.json({ error: `Invalid transition: ${provider.status} -> active` }, 400);
  }
  const [updated] = await db.update(providers).set({
    status: "active",
    activatedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(providers.id, id)).returning();
  await logAudit({ action: "onboarding.activated", userId: user.id, resourceType: "provider", resourceId: id });
  broadcastToUser(provider.userId, { type: "onboarding:activated", data: { providerId: id, providerName: provider.name } });
  // Fire-and-forget notification
  notifyProviderActivated(provider.userId).catch((err) => { console.error("[Notifications] Failed:", err); });
  return c.json(updated, 200);
});
```

**Admin Reject Endpoint — `POST /:id/reject`:**
```typescript
app.post("/:id/reject", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = adminRejectProviderSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);
  if (!isValidProviderTransition(provider.status, "rejected")) {
    return c.json({ error: `Invalid transition: ${provider.status} -> rejected` }, 400);
  }
  const [updated] = await db.update(providers).set({
    status: "rejected",
    suspendedReason: parsed.data.reason, // Reuse suspendedReason for rejection context
    updatedAt: new Date(),
  }).where(eq(providers.id, id)).returning();
  await logAudit({
    action: "onboarding.rejected", userId: user.id, resourceType: "provider", resourceId: id,
    metadata: { reason: parsed.data.reason },
  });
  return c.json(updated, 200);
});
```

**Admin Suspend Endpoint — `POST /:id/suspend`:**
```typescript
app.post("/:id/suspend", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = adminSuspendProviderSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);
  if (!isValidProviderTransition(provider.status, "suspended")) {
    return c.json({ error: `Invalid transition: ${provider.status} -> suspended` }, 400);
  }
  const [updated] = await db.update(providers).set({
    status: "suspended",
    suspendedAt: new Date(),
    suspendedReason: parsed.data.reason,
    updatedAt: new Date(),
  }).where(eq(providers.id, id)).returning();
  await logAudit({
    action: "onboarding.suspended", userId: user.id, resourceType: "provider", resourceId: id,
    metadata: { reason: parsed.data.reason },
  });
  return c.json(updated, 200);
});
```

**Admin Reinstate Endpoint — `POST /:id/reinstate`:**
```typescript
app.post("/:id/reinstate", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);
  if (!isValidProviderTransition(provider.status, "onboarding")) {
    return c.json({ error: `Invalid transition: ${provider.status} -> onboarding` }, 400);
  }
  // Transaction: update provider + reset rejected steps
  await db.transaction(async (tx) => {
    await tx.update(providers).set({
      status: "onboarding",
      suspendedAt: null,
      suspendedReason: null,
      updatedAt: new Date(),
    }).where(eq(providers.id, id));
    // Reset rejected steps to pending (preserve completed steps)
    await tx.update(onboardingSteps).set({
      status: "pending",
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      draftData: null,
      updatedAt: new Date(),
    }).where(and(
      eq(onboardingSteps.providerId, id),
      eq(onboardingSteps.status, "rejected"),
    ));
  });
  await logAudit({
    action: "onboarding.status_changed", userId: user.id, resourceType: "provider", resourceId: id,
    metadata: { previousStatus: "suspended", newStatus: "onboarding", reason: "admin_reinstatement" },
  });
  const updated = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  return c.json(updated, 200);
});
```

**Admin Step Review Endpoint — `PATCH /:id/steps/:stepId`:**
```typescript
app.patch("/:id/steps/:stepId", async (c) => {
  const { id, stepId } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = adminReviewStepSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  // Verify step belongs to this provider
  const step = await db.query.onboardingSteps.findFirst({
    where: and(eq(onboardingSteps.id, stepId), eq(onboardingSteps.providerId, id)),
  });
  if (!step) return c.json({ error: "Step not found" }, 404);
  if (!isValidStepTransition(step.status, parsed.data.status)) {
    return c.json({ error: `Invalid step transition: ${step.status} -> ${parsed.data.status}` }, 400);
  }
  const updateData: Record<string, unknown> = {
    status: parsed.data.status,
    reviewedBy: user.id,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  };
  if (parsed.data.status === "complete") {
    updateData.completedAt = new Date();
    updateData.rejectionReason = null; // Clear any previous rejection
  }
  if (parsed.data.status === "rejected") {
    updateData.rejectionReason = parsed.data.rejectionReason;
    updateData.completedAt = null;
  }
  const [updated] = await db.update(onboardingSteps).set(updateData)
    .where(eq(onboardingSteps.id, stepId)).returning();
  const auditAction = parsed.data.status === "complete" ? "onboarding.step_completed" : "onboarding.step_rejected";
  await logAudit({
    action: auditAction, userId: user.id, resourceType: "onboarding_step", resourceId: stepId,
    metadata: { providerId: id, stepType: step.stepType, newStatus: parsed.data.status,
      ...(parsed.data.rejectionReason && { reason: parsed.data.rejectionReason }) },
  });
  // Broadcast WebSocket event
  const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  if (provider) {
    broadcastToUser(provider.userId, {
      type: "onboarding:step_updated",
      data: { providerId: id, stepType: step.stepType, newStatus: parsed.data.status,
        ...(parsed.data.rejectionReason && { rejectionReason: parsed.data.rejectionReason }) },
    });
  }
  // Auto-transition check: if approving and all steps now complete
  if (parsed.data.status === "complete" && provider?.status === "onboarding") {
    const allSteps = await db.query.onboardingSteps.findMany({
      where: eq(onboardingSteps.providerId, id),
    });
    const allComplete = allSteps.every((s) => s.id === stepId ? true : s.status === "complete");
    if (allComplete) {
      const [transitioned] = await db.update(providers).set({
        status: "pending_review",
        updatedAt: new Date(),
      }).where(and(eq(providers.id, id), eq(providers.status, "onboarding"))).returning();
      if (transitioned) {
        await logAudit({
          action: "onboarding.status_changed", userId: "system", resourceType: "provider", resourceId: id,
          metadata: { previousStatus: "onboarding", newStatus: "pending_review", trigger: "all_steps_complete" },
        });
      }
    }
  }
  return c.json(updated, 200);
});
```

**Provider Reapply Endpoint — `POST /reapply`:**
```typescript
// In server/api/routes/onboarding.ts — requires requireProvider
app.post("/reapply", requireProvider, async (c) => {
  const user = c.get("user");
  const provider = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);
  if (!isValidProviderTransition(provider.status, "applied")) {
    return c.json({ error: `Invalid transition: ${provider.status} -> applied` }, 400);
  }
  // Enforce cool-down (30 days from last status update / rejection)
  const cooldownMs = REAPPLY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const cooldownEnd = new Date(provider.updatedAt.getTime() + cooldownMs);
  if (new Date() < cooldownEnd) {
    return c.json({ error: `Reapply available after ${cooldownEnd.toISOString().split("T")[0]}` }, 400);
  }
  await db.transaction(async (tx) => {
    // Transition provider
    await tx.update(providers).set({
      status: "applied",
      previousApplicationId: provider.id,
      suspendedReason: null,
      updatedAt: new Date(),
    }).where(eq(providers.id, provider.id));
    // Reset ALL onboarding steps
    await tx.update(onboardingSteps).set({
      status: "pending",
      draftData: null,
      metadata: null,
      completedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      updatedAt: new Date(),
    }).where(eq(onboardingSteps.providerId, provider.id));
    // Set background_check to in_progress with fresh Checkr metadata
    await tx.update(onboardingSteps).set({
      status: "in_progress",
      metadata: { checkrCandidateId: null, checkrReportId: null, checkrInvitationId: null },
      updatedAt: new Date(),
    }).where(and(
      eq(onboardingSteps.providerId, provider.id),
      eq(onboardingSteps.stepType, "background_check"),
    ));
    // Immediately transition to onboarding (mirrors initial application flow)
    await tx.update(providers).set({
      status: "onboarding",
      updatedAt: new Date(),
    }).where(eq(providers.id, provider.id));
  });
  await logAudit({
    action: "onboarding.status_changed", userId: user.id, resourceType: "provider", resourceId: provider.id,
    metadata: { previousStatus: "rejected", newStatus: "onboarding", trigger: "reapply" },
  });
  return c.json({ message: "Reapplication successful", redirect: "/provider/onboarding" }, 200);
});
```

**Provider Step Update Endpoint — `PATCH /steps/:stepId`:**
```typescript
// In server/api/routes/onboarding.ts — requires requireProvider
app.patch("/steps/:stepId", requireProvider, async (c) => {
  const { stepId } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = providerStepUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const provider = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);
  // Verify step belongs to this provider
  const step = await db.query.onboardingSteps.findFirst({
    where: and(eq(onboardingSteps.id, stepId), eq(onboardingSteps.providerId, provider.id)),
  });
  if (!step) return c.json({ error: "Step not found" }, 404);
  if (!isValidStepTransition(step.status, parsed.data.status)) {
    return c.json({ error: `Invalid step transition: ${step.status} -> ${parsed.data.status}` }, 400);
  }
  const updateData: Record<string, unknown> = {
    status: parsed.data.status,
    updatedAt: new Date(),
  };
  if (parsed.data.draftData) updateData.draftData = parsed.data.draftData;
  const [updated] = await db.update(onboardingSteps).set(updateData)
    .where(eq(onboardingSteps.id, stepId)).returning();
  // Log first draft save as step_started
  if (parsed.data.status === "draft" && step.status === "pending") {
    await logAudit({
      action: "onboarding.step_started", userId: user.id, resourceType: "onboarding_step", resourceId: stepId,
      metadata: { providerId: provider.id, stepType: step.stepType },
    });
  }
  return c.json(updated, 200);
});
```

### Architecture Compliance

| Rule | Compliance |
|---|---|
| All API routes via Hono, NOT app/api/ | All endpoints added to existing `admin-providers.ts` and `onboarding.ts` Hono modules |
| Zod v4: `import { z } from "zod/v4"` | All new validators use correct import |
| `updatedAt: new Date()` in every `.update().set()` | Included in every update operation — 11 update calls total |
| Destructure `.returning()` | `const [result] = await db.update(...).returning()` everywhere |
| Audit logging for ALL state changes | `logAudit()` on every provider transition, every step review, every reapply |
| Named exports | `export function isValidProviderTransition()` etc. |
| `@/` path alias for all imports | Consistent throughout |
| Fire-and-forget notifications | `.catch((err) => { console.error("[Notifications] Failed:", err); })` on activation notification |
| State machine in `server/api/lib/` | New file at `server/api/lib/onboarding-state-machine.ts` |
| Constants in `lib/constants.ts` | `REAPPLY_COOLDOWN_DAYS` added there |
| Validators in `lib/validators.ts` | 4 new validators added there |
| Admin endpoints use `requireAdmin` | All 6 new admin endpoints inherit from existing `admin-providers.ts` middleware |
| WebSocket events use existing types | `onboarding:step_updated` and `onboarding:activated` already defined in `server/websocket/types.ts` |
| Transaction for multi-table writes | `db.transaction()` used for reinstate (provider + steps) and reapply (provider + steps) |
| TOCTOU protection on status transitions | Provider status checked before update; auto-transition uses `eq(providers.status, "onboarding")` WHERE clause |

### Library & Framework Requirements

| Library | Version | Usage in This Story |
|---|---|---|
| Hono | ^4.11.7 | 6 new admin endpoints + 2 new provider endpoints |
| Drizzle ORM | ^0.45.1 | Query + update providers and onboarding_steps |
| Zod | ^4.3.6 | `import { z } from "zod/v4"` — 4 new validators |
| Vitest | ^4.0.18 | Unit tests for state machine + endpoints |
| ws | ^8.19.0 | `broadcastToUser()` for WebSocket events (existing pattern) |

**No new npm dependencies required.** All libraries already installed.

### File Structure Requirements

**New files (2):**
- `server/api/lib/onboarding-state-machine.ts` — state machine transition validation module
- `tests/unit/onboarding-state-machine.test.ts` — state machine unit tests

**Modified files (4):**
- `server/api/routes/admin-providers.ts` — add 6 new endpoints: `POST /:id/activate`, `POST /:id/reject`, `POST /:id/suspend`, `POST /:id/reinstate`, `PATCH /:id/steps/:stepId`
- `server/api/routes/onboarding.ts` — add 2 new endpoints: `POST /reapply`, `PATCH /steps/:stepId`
- `lib/validators.ts` — add 4 new schemas: `adminRejectProviderSchema`, `adminSuspendProviderSchema`, `adminReviewStepSchema`, `providerStepUpdateSchema`
- `lib/constants.ts` — add `REAPPLY_COOLDOWN_DAYS = 30`

**Modified test files (1):**
- `tests/unit/onboarding-routes.test.ts` — add tests for reapply + step update endpoints

**New test files (2):**
- `tests/unit/onboarding-state-machine.test.ts` — state machine validation tests
- `tests/unit/onboarding-admin-providers.test.ts` — admin endpoint tests

**What NOT to create:**
- No `server/api/routes/admin-onboarding.ts` — admin endpoints go in existing `admin-providers.ts` (same provider management domain)
- No `server/api/middleware/state-machine.ts` — state machine is a pure validation function, not middleware
- No `components/` changes — this story is backend-only (state machine + access control layer)
- No `db/schema/` changes — all schema already exists from 10-1
- No migration needed — using existing columns

### Testing Requirements

**Test framework:** Vitest 4.0.18

**State machine unit tests (`tests/unit/onboarding-state-machine.test.ts`):**
1. `isValidProviderTransition` — `applied → onboarding` returns true
2. `isValidProviderTransition` — `pending_review → active` returns true
3. `isValidProviderTransition` — `pending_review → rejected` returns true
4. `isValidProviderTransition` — `active → suspended` returns true
5. `isValidProviderTransition` — `suspended → onboarding` returns true
6. `isValidProviderTransition` — `rejected → applied` returns true
7. `isValidProviderTransition` — `onboarding → active` returns false (skip pending_review)
8. `isValidProviderTransition` — `active → pending_review` returns false (no backward)
9. `isValidProviderTransition` — `active → rejected` returns false (must suspend first)
10. `isValidStepTransition` — `pending → draft` returns true
11. `isValidStepTransition` — `pending_review → complete` returns true
12. `isValidStepTransition` — `pending_review → rejected` returns true
13. `isValidStepTransition` — `rejected → draft` returns true
14. `isValidStepTransition` — `pending → complete` returns false (skip review)
15. `isValidStepTransition` — `complete → rejected` returns false (no backward from complete)
16. `getValidProviderTransitions` — returns correct options for each status
17. `getValidStepTransitions` — returns correct options for each status

**Admin endpoint tests (`tests/unit/onboarding-admin-providers.test.ts`):**
18. `POST /:id/activate` — success: provider transitions to active, activatedAt set, audit logged
19. `POST /:id/activate` — invalid transition: provider not in pending_review returns 400
20. `POST /:id/activate` — provider not found returns 404
21. `POST /:id/reject` — success: provider transitions to rejected, reason stored, audit logged
22. `POST /:id/reject` — missing reason returns 400
23. `POST /:id/reject` — invalid transition returns 400
24. `POST /:id/suspend` — success: provider suspended, suspendedAt set, audit logged
25. `POST /:id/suspend` — invalid transition (not active) returns 400
26. `POST /:id/reinstate` — success: provider transitions to onboarding, rejected steps reset to pending
27. `POST /:id/reinstate` — completed steps preserved (not reset)
28. `PATCH /:id/steps/:stepId` — approve: step transitions to complete, reviewedBy/At set
29. `PATCH /:id/steps/:stepId` — reject: step transitions to rejected, rejectionReason stored
30. `PATCH /:id/steps/:stepId` — auto-transition: all steps complete triggers provider → pending_review
31. `PATCH /:id/steps/:stepId` — invalid step transition returns 400
32. `PATCH /:id/steps/:stepId` — step not belonging to provider returns 404

**Provider endpoint tests (extend `tests/unit/onboarding-routes.test.ts`):**
33. `POST /reapply` — success: rejected → applied → onboarding, steps reset
34. `POST /reapply` — cool-down not met: returns 400 with available date
35. `POST /reapply` — not rejected provider: returns 400 (invalid transition)
36. `POST /reapply` — background_check step reset to in_progress with Checkr metadata
37. `PATCH /steps/:stepId` — draft save: pending → draft, draftData persisted
38. `PATCH /steps/:stepId` — step not belonging to provider: returns 404
39. `PATCH /steps/:stepId` — invalid transition: returns 400

### Previous Story Intelligence (10-1 and 10-2)

**Key learnings from story 10-1:**
- `initializeOnboardingPipeline()` shared helper creates 5 steps with background_check set to `in_progress` — reapply endpoint must follow the same pattern when resetting steps
- TOCTOU race condition handling: pre-check + try-catch on unique constraints — apply same pattern for concurrent admin actions
- Transactional writes: the /apply endpoint uses `db.transaction()` for multi-table writes — reinstate and reapply must do the same
- Audit log records FCRA consent immutably — never store consent as a provider column
- 24 audit action types already registered (many unused, awaiting this story to wire them)

**Key learnings from story 10-2:**
- `requireOnboardingComplete` middleware is self-contained (calls `auth()` directly) — it checks provider status at request time, so suspending a provider immediately blocks their next request
- Auto-transition logic in `GET /dashboard` uses a TOCTOU-safe UPDATE with status-guard WHERE clause (`eq(providers.status, "onboarding")`) — the step review auto-transition in this story must replicate this pattern
- WebSocket broadcast pattern: `broadcastToUser(provider.userId, { type, data })` — use same pattern for `onboarding:activated` event
- Rate limiting was moved from global to per-route in `onboarding.ts` — new endpoints (reapply, step update) don't need rate limiting since they require authentication
- Provider sidebar uses `useProviderStatus` hook — status changes from this story will automatically reflect in the sidebar on next fetch
- Review found: double `auth()` call on gated requests (L2 issue) — accept this as-is, not worth refactoring for this story
- All 171 tests pass after 10-2 — maintain this baseline

**Files created/modified by 10-1 and 10-2 that this story extends:**
- `server/api/routes/onboarding.ts` (413 lines) — add `POST /reapply` + `PATCH /steps/:stepId`
- `server/api/routes/admin-providers.ts` (584 lines) — add 6 new endpoints
- `server/api/lib/audit-logger.ts` (258 lines) — all audit actions already registered, just wire them
- `lib/validators.ts` (446 lines) — append 4 new validators
- `lib/constants.ts` (132 lines) — append `REAPPLY_COOLDOWN_DAYS`
- `tests/unit/onboarding-routes.test.ts` — extend with 7 new tests

### Git Intelligence Summary

| Commit | Relevance |
|---|---|
| `4612bce` Fix remaining lint errors | Medium — maintain clean lint baseline, no new lint errors |
| `b27bfda` Fix lint errors: setState-in-effect | Low — no client components in this story |
| `16fde76` Add collapsible sidebars | Low — no UI changes in this story |
| `5e5f4b5` Redesign marketing UI | Low — no marketing page changes |
| `6a0e36d` Harden Stripe integration | Medium — webhook event patterns for reference; Stripe audit patterns |
| `1ac1750` Add unit test suite with Vitest | Critical — follow existing test structure, mock patterns |

### Project Structure Notes

- This story is **entirely backend** — no new pages, no new components, no UI changes
- The state machine module (`server/api/lib/onboarding-state-machine.ts`) is the **single source of truth** for transition validation — future stories (document upload, Checkr webhook, Stripe Connect) will import and use these functions
- The admin step review endpoint is the foundation for Epics 11 (Document Upload) and 12 (Checkr Integration) — those stories will trigger step status changes via the state machine, and admin will review via this endpoint
- `broadcastToUser()` function must be imported from the WebSocket module — check existing `onboarding.ts` for the import path pattern
- The `notifyProviderActivated()` notification function may not exist yet — create a minimal stub that logs the notification intent, or use existing notification patterns from `lib/notifications/index.ts`
- Provider `suspendedReason` column is reused for rejection reason context — this is intentional (single column for admin-provided reason, regardless of whether the action is rejection or suspension)

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md` — State Transition Authority Matrix (line ~864)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Step Status Transitions (lines ~1259-1282)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — requireOnboardingComplete Middleware Decision 2.1 (lines ~1002-1008)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Cross-Cutting Concern #1: Provider lifecycle enforcement (line ~882)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Enforcement Guidelines (lines ~1326-1355)]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR11 (onboarding state machine), FR12 (portal gate)]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1 FR mapping: FR11-FR12]
- [Source: `_bmad-output/implementation-artifacts/10-1-onboarding-schema-application-form-and-registration.md` — Schema, transaction patterns, audit logging]
- [Source: `_bmad-output/implementation-artifacts/10-2-provider-onboarding-dashboard.md` — Auto-transition, WebSocket, middleware patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Used `.refine()` instead of `.check()` for `adminReviewStepSchema` conditional validation — `.check()` expects void return in Zod v4, `.refine()` is the correct approach (consistent with all other validators in the file)
- `notifyProviderActivated()` does not exist as a dedicated function — used `sendEmail()` directly for the activation notification (fire-and-forget pattern), keeping it simple until a full notification orchestrator function is needed
- All admin endpoints include TOCTOU protection via status-guard WHERE clauses on updates (e.g., `eq(providers.status, "pending_review")`)
- Reinstate endpoint uses `db.transaction()` for atomic provider update + step reset
- Reapply endpoint uses `db.transaction()` for atomic provider transition + step reset + background_check init
- Linter auto-fixed the `safeSteps` destructuring in `onboarding.ts` dashboard endpoint to explicit field mapping (no functional change)
- 237 total tests pass (up from 171 baseline): +39 state machine, +17 admin endpoints, +10 provider endpoints

### File List

**New files:**
- `server/api/lib/onboarding-state-machine.ts` — State machine transition validation (42 lines)
- `tests/unit/onboarding-state-machine.test.ts` — 39 state machine tests
- `tests/unit/onboarding-admin-providers.test.ts` — 17 admin endpoint tests

**Modified files:**
- `server/api/routes/admin-providers.ts` — Added 5 endpoints: activate, reject, suspend, reinstate, step review (+250 lines)
- `server/api/routes/onboarding.ts` — Added 2 endpoints: reapply, step update (+110 lines)
- `lib/validators.ts` — Added 4 schemas: adminRejectProviderSchema, adminSuspendProviderSchema, adminReviewStepSchema, providerStepUpdateSchema
- `lib/constants.ts` — Added REAPPLY_COOLDOWN_DAYS = 30
- `tests/unit/onboarding-routes.test.ts` — Extended with 10 new tests for reapply + step update
