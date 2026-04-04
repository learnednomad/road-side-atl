import { Hono } from "hono";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { providers } from "@/db/schema/providers";
import { onboardingSteps } from "@/db/schema/onboarding-steps";
import { providerDocuments } from "@/db/schema/provider-documents";
import { providerInvites } from "@/db/schema/provider-invites";
import { eq, and, isNull, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { providerApplicationSchema, inviteAcceptSchema, providerStepUpdateSchema, documentUploadUrlSchema, documentCreateSchema } from "@/lib/validators";
import { ONBOARDING_STEP_TYPES, REAPPLY_COOLDOWN_DAYS, PRESIGNED_UPLOAD_EXPIRY, PRESIGNED_DOWNLOAD_EXPIRY_PROVIDER, MIN_DOCUMENTS_PER_STEP, CHECKR_PACKAGE } from "@/lib/constants";
import { isValidProviderTransition, isValidStepTransition } from "../lib/onboarding-state-machine";
import { rateLimitStrict } from "../middleware/rate-limit";
import { requireProvider } from "../middleware/auth";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import { broadcastToUser, broadcastToAdmins } from "@/server/websocket/broadcast";
import { getPresignedUploadUrl, getPresignedUrl } from "@/lib/s3";
import { createCandidate, createInvitation, CheckrApiError } from "../lib/checkr";
import { stripe } from "@/lib/stripe";
import { checkAllStepsCompleteAndTransition } from "../lib/all-steps-complete";
import { notifyApplicationReceived, notifyTrainingCompleted, notifyStripeConnectCompleted, notifyAdminProviderReadyForReview, notifyAdminNewDocumentSubmitted } from "@/lib/notifications";

const app = new Hono();

// --- Authenticated provider endpoints ---

// GET /dashboard — returns onboarding steps + provider summary
app.get("/dashboard", requireProvider, async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider not found" }, 404);
  }

  const steps = await db.query.onboardingSteps.findMany({
    where: eq(onboardingSteps.providerId, provider.id),
    orderBy: [asc(onboardingSteps.stepType)],
  });

  // Strip admin-internal fields before returning to provider
  const safeSteps = steps.map((step) => ({
    id: step.id,
    providerId: step.providerId,
    stepType: step.stepType,
    status: step.status,
    draftData: step.draftData,
    metadata: step.metadata,
    rejectionReason: step.rejectionReason,
    completedAt: step.completedAt,
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
  }));

  const completedStepsCount = steps.filter((s) => s.status === "complete").length;
  const totalSteps = steps.length;

  // Auto-transition: if all steps complete and provider is still "onboarding" → "pending_review"
  // WHERE includes status guard to prevent duplicate transitions (TOCTOU)
  if (
    totalSteps > 0 &&
    completedStepsCount === totalSteps &&
    provider.status === "onboarding"
  ) {
    const result = await db
      .update(providers)
      .set({ status: "pending_review", updatedAt: new Date() })
      .where(and(eq(providers.id, provider.id), eq(providers.status, "onboarding")))
      .returning();

    // Only log + broadcast if this request actually performed the transition
    if (result.length > 0) {
      const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
      logAudit({
        action: "onboarding.status_changed",
        userId: user.id,
        resourceType: "provider",
        resourceId: provider.id,
        details: {
          previousStatus: "onboarding",
          newStatus: "pending_review",
          reason: "all_steps_complete",
        },
        ipAddress,
        userAgent,
      });

      // Notify provider via WebSocket — dashboard will re-fetch
      broadcastToUser(user.id, {
        type: "onboarding:step_updated",
        data: {
          providerId: provider.id,
          stepType: "all",
          newStatus: "pending_review",
        },
      });

      // Admin notification is handled by checkAllStepsCompleteAndTransition in step-completion endpoints.
      // Dashboard GET is a fallback transition — only fires if no step endpoint triggered it first.
      notifyAdminProviderReadyForReview(provider.id, provider.name || "").catch((err) => {
        console.error("[Notifications] Failed:", err);
      });
    }

    return c.json({
      steps: safeSteps,
      provider: {
        status: "pending_review",
        name: provider.name,
        completedStepsCount,
        totalSteps,
        migrationBypassExpiresAt: provider.migrationBypassExpiresAt?.toISOString() ?? null,
        isMigrating: false,
      },
    });
  }

  const isMigrating = provider.status === "active" && !!provider.migrationBypassExpiresAt;

  return c.json({
    steps: safeSteps,
    provider: {
      status: provider.status,
      name: provider.name,
      completedStepsCount,
      totalSteps,
      migrationBypassExpiresAt: provider.migrationBypassExpiresAt?.toISOString() ?? null,
      isMigrating,
    },
  });
});

// --- Public endpoints (rate limited) ---

// Rate limit public endpoints only
app.use("/apply", rateLimitStrict);
app.use("/invite-accept", rateLimitStrict);

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Shared post-registration pipeline: create onboarding steps,
 * set background_check to in_progress, and transition provider to onboarding.
 * All operations run inside the caller's transaction.
 */
async function initializeOnboardingPipeline(
  tx: TransactionClient,
  providerId: string,
) {
  // Create 5 onboarding step rows — all pending
  const stepRows = ONBOARDING_STEP_TYPES.map((stepType) => ({
    providerId,
    stepType: stepType as typeof onboardingSteps.$inferInsert.stepType,
    status: "pending" as const,
  }));

  const steps = await tx
    .insert(onboardingSteps)
    .values(stepRows)
    .returning();

  // Set background_check step to in_progress with Checkr metadata placeholder
  const bgStep = steps.find((s) => s.stepType === "background_check");
  if (bgStep) {
    await tx
      .update(onboardingSteps)
      .set({
        status: "in_progress",
        metadata: {
          checkrCandidateId: null,
          checkrReportId: null,
          checkrInvitationId: null,
        },
        updatedAt: new Date(),
      })
      .where(eq(onboardingSteps.id, bgStep.id));
  }

  // Transition provider status: applied → onboarding
  await tx
    .update(providers)
    .set({ status: "onboarding", updatedAt: new Date() })
    .where(eq(providers.id, providerId));

  return { steps, bgStep };
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "Unknown", lastName: "Unknown" };
  const parts = trimmed.split(" ");
  const firstName = parts[0]!;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : firstName;
  return { firstName, lastName };
}

/**
 * Initiate Checkr background check and update step metadata with Checkr IDs.
 * Called post-transaction so provider/step already exist.
 * Handles Checkr failure gracefully — step stays in_progress with null metadata.
 */
async function initiateCheckrBackgroundCheck(
  bgStepId: string,
  providerId: string,
  userId: string,
  providerData: { firstName: string; lastName: string; email: string; dob?: string },
  ipAddress: string,
  userAgent: string,
): Promise<boolean> {
  try {
    if (!providerData.dob) {
      console.warn("[Checkr] No DOB provided for provider %s — deferring background check initiation", providerId);
      return false;
    }

    const candidate = await createCandidate({
      firstName: providerData.firstName,
      lastName: providerData.lastName,
      email: providerData.email,
      dob: providerData.dob,
    });

    const invitation = await createInvitation(candidate.id, CHECKR_PACKAGE);

    // Update step metadata with Checkr IDs
    await db
      .update(onboardingSteps)
      .set({
        metadata: {
          checkrCandidateId: candidate.id,
          checkrReportId: null, // Set by report.completed webhook with actual report ID
          checkrInvitationId: invitation.id,
        },
        updatedAt: new Date(),
      })
      .where(eq(onboardingSteps.id, bgStepId));

    logAudit({
      action: "checkr.candidate_created",
      userId,
      resourceType: "onboarding_step",
      resourceId: bgStepId,
      details: {
        providerId,
        checkrCandidateId: candidate.id,
        checkrInvitationId: invitation.id,
      },
      ipAddress,
      userAgent,
    });
    return true;
  } catch (err) {
    // Log failure but don't throw — step stays in_progress with null metadata
    console.error("[Checkr] Failed to initiate background check:", err);
    logAudit({
      action: "checkr.candidate_created",
      userId,
      resourceType: "onboarding_step",
      resourceId: bgStepId,
      details: {
        providerId,
        error: err instanceof CheckrApiError ? `${err.statusCode}: ${err.message}` : "Unknown error",
        needsRetry: true,
      },
      ipAddress,
      userAgent,
    });
    return false;
  }
}

// POST /apply — public provider application
app.post("/apply", async (c) => {
  const body = await c.req.json();
  const parsed = providerApplicationSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { name, email, password, phone, dob, serviceArea, specialties } = parsed.data;
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  // Check for existing user
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existingUser) {
    return c.json({ error: "An account with this email already exists" }, 409);
  }

  // Check for existing provider
  const existingProvider = await db.query.providers.findFirst({
    where: eq(providers.email, email),
  });
  if (existingProvider) {
    return c.json({ error: "A provider with this email already exists" }, 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Transactional: create user + provider + onboarding steps + pipeline setup
  let result;
  try {
    result = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          name,
          email,
          phone,
          password: hashedPassword,
          role: "provider",
          emailVerified: new Date(),
        })
        .returning({ id: users.id });

      const [newProvider] = await tx
        .insert(providers)
        .values({
          userId: newUser.id,
          name,
          email,
          phone,
          specialties: specialties ?? [],
          address: serviceArea.join(", "),
          status: "applied",
        })
        .returning();

      const { steps, bgStep } = await initializeOnboardingPipeline(tx, newProvider.id);

      return { user: newUser, provider: newProvider, steps, bgStep };
    });
  } catch (err) {
    // Handle race condition: concurrent request created same email between pre-check and transaction
    if (err instanceof Error && err.message.includes("unique")) {
      return c.json({ error: "An account with this email already exists" }, 409);
    }
    throw err;
  }

  // Log FCRA consent — immutable audit record (NEVER as a provider column)
  logAudit({
    action: "onboarding.fcra_consent",
    userId: result.user.id,
    resourceType: "provider",
    resourceId: result.provider.id,
    details: {
      providerId: result.provider.id,
      timestamp: new Date().toISOString(),
      ipAddress,
      consentVersion: "1.0",
    },
    ipAddress,
    userAgent,
  });

  if (result.bgStep) {
    logAudit({
      action: "onboarding.step_started",
      userId: result.user.id,
      resourceType: "onboarding_step",
      resourceId: result.bgStep.id,
      details: { stepType: "background_check", providerId: result.provider.id },
      ipAddress,
      userAgent,
    });

    // Initiate Checkr background check (post-transaction, non-blocking)
    initiateCheckrBackgroundCheck(
      result.bgStep.id,
      result.provider.id,
      result.user.id,
      { ...splitName(name), email, dob },
      ipAddress,
      userAgent,
    ).catch((err) => {
      console.error("[Checkr] Background check initiation failed:", err);
    });
  }

  // FR55: Application received notification
  notifyApplicationReceived(result.user.id, name, email, phone).catch((err) => {
    console.error("[Notifications] Failed:", err);
  });

  return c.json(
    {
      provider: { ...result.provider, status: "onboarding" },
      steps: result.steps.map((s) =>
        s.stepType === "background_check" ? { ...s, status: "in_progress" } : s
      ),
    },
    201,
  );
});

// POST /invite-accept — accept an onboarding invite
app.post("/invite-accept", async (c) => {
  const body = await c.req.json();
  const parsed = inviteAcceptSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { inviteToken, password, phone, serviceArea, specialties } = parsed.data;
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  // Look up invite
  const invite = await db.query.providerInvites.findFirst({
    where: and(
      eq(providerInvites.token, inviteToken),
      isNull(providerInvites.usedAt),
    ),
  });

  if (!invite) {
    return c.json({ error: "Invalid or already used invite token" }, 400);
  }

  if (new Date() > invite.expiresAt) {
    return c.json({ error: "Invite token has expired" }, 400);
  }

  // Check for existing user
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, invite.email),
  });
  if (existingUser) {
    return c.json({ error: "An account with this email already exists" }, 409);
  }

  // Check for existing provider
  const existingProvider = await db.query.providers.findFirst({
    where: eq(providers.email, invite.email),
  });
  if (existingProvider) {
    return c.json({ error: "A provider with this email already exists" }, 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Transactional: create user + provider + steps + mark invite used + pipeline setup
  let result;
  try {
    result = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          name: invite.name,
          email: invite.email,
          phone,
          password: hashedPassword,
          role: "provider",
          emailVerified: new Date(), // Invite email is pre-verified
        })
        .returning({ id: users.id });

      const [newProvider] = await tx
        .insert(providers)
        .values({
          userId: newUser.id,
          name: invite.name,
          email: invite.email,
          phone,
          specialties: specialties ?? [],
          address: serviceArea.join(", "),
          status: "applied",
        })
        .returning();

      // Mark invite as used
      await tx
        .update(providerInvites)
        .set({ usedAt: new Date() })
        .where(eq(providerInvites.id, invite.id));

      const { steps, bgStep } = await initializeOnboardingPipeline(tx, newProvider.id);

      return { user: newUser, provider: newProvider, steps, bgStep };
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("unique")) {
      return c.json({ error: "An account with this email already exists" }, 409);
    }
    throw err;
  }

  // Log FCRA consent
  logAudit({
    action: "onboarding.fcra_consent",
    userId: result.user.id,
    resourceType: "provider",
    resourceId: result.provider.id,
    details: {
      providerId: result.provider.id,
      timestamp: new Date().toISOString(),
      ipAddress,
      consentVersion: "1.0",
      inviteId: invite.id,
    },
    ipAddress,
    userAgent,
  });

  if (result.bgStep) {
    logAudit({
      action: "onboarding.step_started",
      userId: result.user.id,
      resourceType: "onboarding_step",
      resourceId: result.bgStep.id,
      details: { stepType: "background_check", providerId: result.provider.id },
      ipAddress,
      userAgent,
    });
  }

  logAudit({
    action: "onboarding.invite_accepted",
    userId: result.user.id,
    resourceType: "provider",
    resourceId: result.provider.id,
    details: { inviteId: invite.id },
    ipAddress,
    userAgent,
  });

  if (result.bgStep) {
    // Initiate Checkr background check (post-transaction, non-blocking)
    initiateCheckrBackgroundCheck(
      result.bgStep.id,
      result.provider.id,
      result.user.id,
      { ...splitName(invite.name), email: invite.email },
      ipAddress,
      userAgent,
    ).catch((err) => {
      console.error("[Checkr] Background check initiation failed:", err);
    });
  }

  // FR55: Application received notification
  notifyApplicationReceived(result.user.id, invite.name, invite.email, phone).catch((err) => {
    console.error("[Notifications] Failed:", err);
  });

  return c.json(
    {
      provider: { ...result.provider, status: "onboarding" },
      steps: result.steps.map((s) =>
        s.stepType === "background_check" ? { ...s, status: "in_progress" } : s
      ),
    },
    201,
  );
});

// --- Provider reapply and step update endpoints ---

// POST /reapply — provider reapplies after rejection
app.post("/reapply", requireProvider, async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  if (!isValidProviderTransition(provider.status, "applied")) {
    return c.json({
      error: `Invalid transition: ${provider.status} -> applied`,
    }, 400);
  }

  // Enforce cool-down (30 days from last status update / rejection)
  const cooldownMs = REAPPLY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const cooldownEnd = new Date(provider.updatedAt.getTime() + cooldownMs);
  if (new Date() < cooldownEnd) {
    return c.json({
      error: `Reapply available after ${cooldownEnd.toISOString().split("T")[0]}`,
    }, 400);
  }

  await db.transaction(async (tx) => {
    // Transition provider to applied
    await tx
      .update(providers)
      .set({
        status: "applied",
        previousApplicationId: provider.id,
        suspendedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(providers.id, provider.id));

    // Reset ALL onboarding steps
    await tx
      .update(onboardingSteps)
      .set({
        status: "pending",
        draftData: null,
        metadata: null,
        completedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(onboardingSteps.providerId, provider.id));

    // Set background_check to in_progress with fresh Checkr metadata
    await tx
      .update(onboardingSteps)
      .set({
        status: "in_progress",
        metadata: {
          checkrCandidateId: null,
          checkrReportId: null,
          checkrInvitationId: null,
        },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(onboardingSteps.providerId, provider.id),
          eq(onboardingSteps.stepType, "background_check"),
        ),
      );

    // Immediately transition to onboarding (mirrors initial application flow)
    await tx
      .update(providers)
      .set({
        status: "onboarding",
        updatedAt: new Date(),
      })
      .where(eq(providers.id, provider.id));
  });

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "onboarding.status_changed",
    userId: user.id,
    resourceType: "provider",
    resourceId: provider.id,
    details: {
      previousStatus: "rejected",
      newStatus: "onboarding",
      trigger: "reapply",
    },
    ipAddress,
    userAgent,
  });

  return c.json(
    { message: "Reapplication successful", redirect: "/provider/onboarding" },
    200,
  );
});

// PATCH /steps/:stepId — provider updates a step (draft save, submit)
app.patch("/steps/:stepId", requireProvider, async (c) => {
  const { stepId } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = providerStepUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  // Verify step belongs to this provider
  const step = await db.query.onboardingSteps.findFirst({
    where: and(
      eq(onboardingSteps.id, stepId),
      eq(onboardingSteps.providerId, provider.id),
    ),
  });
  if (!step) return c.json({ error: "Step not found" }, 404);

  if (!isValidStepTransition(step.status, parsed.data.status)) {
    return c.json({
      error: `Invalid step transition: ${step.status} -> ${parsed.data.status}`,
    }, 400);
  }

  const updateData: Record<string, unknown> = {
    status: parsed.data.status,
    updatedAt: new Date(),
  };
  if (parsed.data.draftData) updateData.draftData = parsed.data.draftData;

  const [updated] = await db
    .update(onboardingSteps)
    .set(updateData)
    .where(eq(onboardingSteps.id, stepId))
    .returning();

  // Log first draft save as step_started
  if (parsed.data.status === "draft" && step.status === "pending") {
    const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
    logAudit({
      action: "onboarding.step_started",
      userId: user.id,
      resourceType: "onboarding_step",
      resourceId: stepId,
      details: { providerId: provider.id, stepType: step.stepType },
      ipAddress,
      userAgent,
    });
  }

  return c.json(updated, 200);
});

// ── Training Module Endpoints ─────────────────────────────────────

// GET /training — get training cards with acknowledgment status
app.get("/training", requireProvider, async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const step = await db.query.onboardingSteps.findFirst({
    where: and(
      eq(onboardingSteps.providerId, provider.id),
      eq(onboardingSteps.stepType, "training"),
    ),
  });
  if (!step) return c.json({ error: "Training step not found" }, 404);

  const { TRAINING_CARDS, TOTAL_TRAINING_CARDS } = await import("@/lib/training-content");

  const acknowledgedCards = (step.draftData as { acknowledgedCards?: string[] } | null)
    ?.acknowledgedCards || [];

  return c.json({
    stepId: step.id,
    status: step.status,
    totalCards: TOTAL_TRAINING_CARDS,
    acknowledgedCount: acknowledgedCards.length,
    acknowledgedCards,
    cards: TRAINING_CARDS.map((card) => ({
      ...card,
      acknowledged: acknowledgedCards.includes(card.id),
    })),
  });
});

// POST /training/acknowledge/:cardId — acknowledge a single training card
app.post("/training/acknowledge/:cardId", requireProvider, async (c) => {
  const { cardId } = c.req.param();
  const user = c.get("user");

  const { TRAINING_CARDS, TOTAL_TRAINING_CARDS } = await import("@/lib/training-content");

  const card = TRAINING_CARDS.find((tc) => tc.id === cardId);
  if (!card) return c.json({ error: "Invalid training card ID" }, 400);

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const step = await db.query.onboardingSteps.findFirst({
    where: and(
      eq(onboardingSteps.providerId, provider.id),
      eq(onboardingSteps.stepType, "training"),
    ),
  });
  if (!step) return c.json({ error: "Training step not found" }, 404);

  if (step.status === "complete") {
    return c.json({ error: "Training already completed" }, 400);
  }

  const draftData = (step.draftData as { acknowledgedCards?: string[] } | null) || {};
  const acknowledgedCards = new Set(draftData.acknowledgedCards || []);
  acknowledgedCards.add(cardId);
  const acknowledgedArray = [...acknowledgedCards];

  const isAllAcknowledged = acknowledgedArray.length >= TOTAL_TRAINING_CARDS;

  const updateData: Record<string, unknown> = {
    draftData: { acknowledgedCards: acknowledgedArray },
    updatedAt: new Date(),
  };

  // Auto-transition when pending → draft (first card)
  if (step.status === "pending") {
    updateData.status = "draft";
  }

  // Auto-complete when all cards are acknowledged
  if (isAllAcknowledged) {
    updateData.status = "complete";
    updateData.completedAt = new Date();
  }

  const [updated] = await db
    .update(onboardingSteps)
    .set(updateData)
    .where(eq(onboardingSteps.id, step.id))
    .returning();

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "training.card_acknowledged",
    userId: user.id,
    resourceType: "onboarding_step",
    resourceId: step.id,
    details: {
      providerId: provider.id,
      cardId,
      cardTitle: card.title,
      acknowledgedCount: acknowledgedArray.length,
      totalCards: TOTAL_TRAINING_CARDS,
    },
    ipAddress,
    userAgent,
  });

  if (isAllAcknowledged) {
    logAudit({
      action: "training.module_completed",
      userId: user.id,
      resourceType: "onboarding_step",
      resourceId: step.id,
      details: { providerId: provider.id, totalCards: TOTAL_TRAINING_CARDS },
      ipAddress,
      userAgent,
    });

    broadcastToUser(user.id, {
      type: "onboarding:step_updated",
      data: { providerId: provider.id, stepType: "training", newStatus: "complete" },
    });

    notifyTrainingCompleted(provider.id).catch((err) => {
      console.error("[Notifications] Failed:", err);
    });

    // Check if all steps are now complete
    await checkAllStepsCompleteAndTransition(
      provider.id,
      step.id,
      "training.all_cards_acknowledged",
      { userId: user.id, ipAddress, userAgent },
    );
  }

  return c.json({
    stepId: step.id,
    status: updated.status,
    acknowledgedCount: acknowledgedArray.length,
    totalCards: TOTAL_TRAINING_CARDS,
    isComplete: isAllAcknowledged,
  });
});

// POST /background-check/retry — retry Checkr initiation for failed initial call
app.post("/background-check/retry", requireProvider, async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const bgStep = await db.query.onboardingSteps.findFirst({
    where: and(
      eq(onboardingSteps.providerId, provider.id),
      eq(onboardingSteps.stepType, "background_check"),
    ),
  });
  if (!bgStep) return c.json({ error: "Background check step not found" }, 404);

  // Only allow retry if metadata has null Checkr IDs (failed initial call)
  const metadata = bgStep.metadata as { checkrCandidateId?: string | null } | null;
  if (metadata?.checkrCandidateId) {
    return c.json({ error: "Background check already initiated" }, 400);
  }

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  const success = await initiateCheckrBackgroundCheck(
    bgStep.id,
    provider.id,
    user.id,
    {
      ...splitName(provider.name),
      email: provider.email,
      dob: (bgStep.metadata as Record<string, unknown> | null)?.dob as string | undefined,
    },
    ipAddress,
    userAgent,
  );

  if (!success) {
    return c.json({ error: "Background check service temporarily unavailable" }, 503);
  }
  return c.json({ message: "Background check initiated successfully" }, 200);
});

// --- Document upload endpoints ---

// POST /upload-url — generate presigned S3 upload URL
app.post("/upload-url", requireProvider, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = documentUploadUrlSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);

  const provider = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const ext = parsed.data.fileName.split(".").pop() || "jpg";
  const s3Key = `onboarding/${provider.id}/${parsed.data.documentType}/${Date.now()}.${ext}`;

  const uploadUrl = await getPresignedUploadUrl(s3Key, parsed.data.mimeType, PRESIGNED_UPLOAD_EXPIRY);

  return c.json({ uploadUrl, s3Key, expiresIn: PRESIGNED_UPLOAD_EXPIRY }, 200);
});

// POST /documents — create provider_documents record after S3 upload
app.post("/documents", requireProvider, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = documentCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);

  const provider = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  // Verify S3 key belongs to this provider (prevent key injection)
  if (!parsed.data.s3Key.startsWith(`onboarding/${provider.id}/`)) {
    return c.json({ error: "Invalid S3 key" }, 400);
  }

  // Verify onboarding step belongs to this provider
  const step = await db.query.onboardingSteps.findFirst({
    where: and(
      eq(onboardingSteps.id, parsed.data.onboardingStepId),
      eq(onboardingSteps.providerId, provider.id),
    ),
  });
  if (!step) return c.json({ error: "Onboarding step not found" }, 404);

  // Check if this is a re-upload after rejection (existing rejected doc for same step/type)
  const existingRejected = await db.query.providerDocuments.findFirst({
    where: and(
      eq(providerDocuments.onboardingStepId, parsed.data.onboardingStepId),
      eq(providerDocuments.providerId, provider.id),
      eq(providerDocuments.documentType, parsed.data.documentType as "insurance" | "certification" | "vehicle_doc"),
      eq(providerDocuments.status, "rejected"),
    ),
  });

  const [doc] = await db.insert(providerDocuments).values({
    providerId: provider.id,
    onboardingStepId: parsed.data.onboardingStepId,
    documentType: parsed.data.documentType as "insurance" | "certification" | "vehicle_doc",
    s3Key: parsed.data.s3Key,
    originalFileName: parsed.data.originalFileName,
    fileSize: parsed.data.fileSize,
    mimeType: parsed.data.mimeType,
    status: "pending_review",
  }).returning();

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  const auditAction = existingRejected ? "document.resubmitted" : "document.uploaded";
  logAudit({
    action: auditAction,
    userId: user.id,
    resourceType: "provider_document",
    resourceId: doc.id,
    details: {
      providerId: provider.id,
      documentType: parsed.data.documentType,
      stepId: step.id,
      ...(existingRejected && { previousDocumentId: existingRejected.id }),
    },
    ipAddress,
    userAgent,
  });

  return c.json(doc, 201);
});

// GET /documents — returns all documents for the authenticated provider grouped by step
app.get("/documents", requireProvider, async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const docs = await db.query.providerDocuments.findMany({
    where: eq(providerDocuments.providerId, provider.id),
    orderBy: [asc(providerDocuments.createdAt)],
  });

  // Group by onboardingStepId
  const grouped = docs.reduce((acc, doc) => {
    const stepId = doc.onboardingStepId;
    if (!acc[stepId]) acc[stepId] = [];
    acc[stepId].push(doc);
    return acc;
  }, {} as Record<string, typeof docs>);

  return c.json({ documents: grouped }, 200);
});

// GET /documents/:documentId/url — presigned download URL for provider's own document
app.get("/documents/:documentId/url", requireProvider, async (c) => {
  const { documentId } = c.req.param();
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const doc = await db.query.providerDocuments.findFirst({
    where: and(eq(providerDocuments.id, documentId), eq(providerDocuments.providerId, provider.id)),
  });
  if (!doc) return c.json({ error: "Document not found" }, 404);

  const downloadUrl = await getPresignedUrl(doc.s3Key, PRESIGNED_DOWNLOAD_EXPIRY_PROVIDER);
  return c.json({ downloadUrl, expiresIn: PRESIGNED_DOWNLOAD_EXPIRY_PROVIDER }, 200);
});

// POST /steps/:stepId/submit — submit documents for review
app.post("/steps/:stepId/submit", requireProvider, async (c) => {
  const { stepId } = c.req.param();
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const step = await db.query.onboardingSteps.findFirst({
    where: and(
      eq(onboardingSteps.id, stepId),
      eq(onboardingSteps.providerId, provider.id),
    ),
  });
  if (!step) return c.json({ error: "Step not found" }, 404);

  // Only insurance and certifications steps can be submitted this way
  if (step.stepType !== "insurance" && step.stepType !== "certifications") {
    return c.json({ error: "This step does not support document submission" }, 400);
  }

  // Check valid transition: pending/draft → in_progress
  if (!isValidStepTransition(step.status, "in_progress")) {
    return c.json({ error: `Invalid step transition: ${step.status} -> in_progress` }, 400);
  }

  // Check minimum document count
  const docs = await db.query.providerDocuments.findMany({
    where: and(
      eq(providerDocuments.onboardingStepId, stepId),
      eq(providerDocuments.providerId, provider.id),
    ),
  });

  // Map step type to document type for MIN_DOCUMENTS_PER_STEP lookup
  const docTypeKey = step.stepType === "certifications" ? "certifications" : step.stepType;
  const minDocs = MIN_DOCUMENTS_PER_STEP[docTypeKey] ?? 1;
  if (docs.length < minDocs) {
    return c.json({ error: `At least ${minDocs} document(s) required before submission` }, 400);
  }

  const [updated] = await db.update(onboardingSteps).set({
    status: "in_progress",
    updatedAt: new Date(),
  }).where(eq(onboardingSteps.id, stepId)).returning();

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "onboarding.step_started",
    userId: user.id,
    resourceType: "onboarding_step",
    resourceId: stepId,
    details: { providerId: provider.id, stepType: step.stepType, trigger: "document_submission" },
    ipAddress,
    userAgent,
  });

  // Broadcast to admins
  broadcastToAdmins({
    type: "onboarding:new_submission",
    data: { providerId: provider.id, providerName: provider.name, stepType: step.stepType },
  });

  notifyAdminNewDocumentSubmitted(provider.id, provider.name, step.stepType).catch((err) => {
    console.error("[Notifications] Failed:", err);
  });

  return c.json(updated, 200);
});

// --- Stripe Connect endpoints ---

// POST /stripe-link — create Connect Express account (if needed) and generate onboarding link
app.post("/stripe-link", requireProvider, async (c) => {
  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  // Find stripe_connect step
  const step = await db.query.onboardingSteps.findFirst({
    where: and(
      eq(onboardingSteps.providerId, provider.id),
      eq(onboardingSteps.stepType, "stripe_connect"),
    ),
  });
  if (!step) return c.json({ error: "Stripe Connect step not found" }, 404);

  let accountId = provider.stripeConnectAccountId;

  try {
    if (!accountId) {
      // Create new Express account
      const account = await stripe.accounts.create({
        type: "express",
        email: provider.email,
        metadata: { providerId: provider.id },
      });
      accountId = account.id;

      // Store account ID in providers table
      await db
        .update(providers)
        .set({ stripeConnectAccountId: accountId, updatedAt: new Date() })
        .where(eq(providers.id, provider.id));

      // Update step metadata and transition pending → in_progress (TOCTOU guard)
      if (isValidStepTransition(step.status, "in_progress")) {
        await db
          .update(onboardingSteps)
          .set({
            status: "in_progress",
            metadata: { stripeConnectAccountId: accountId },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(onboardingSteps.id, step.id),
              eq(onboardingSteps.status, "pending"),
            ),
          );
      }

      logAudit({
        action: "stripe_connect.account_created",
        userId: user.id,
        resourceType: "onboarding_step",
        resourceId: step.id,
        details: {
          providerId: provider.id,
          stripeConnectAccountId: accountId,
        },
        ipAddress,
        userAgent,
      });
    }

    // Generate onboarding link (works for both new and re-entry)
    const link = await stripe.accountLinks.create({
      account: accountId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/provider/onboarding?stripe=complete`,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/provider/onboarding?stripe=refresh`,
      type: "account_onboarding",
    });

    logAudit({
      action: "stripe_connect.link_generated",
      userId: user.id,
      resourceType: "onboarding_step",
      resourceId: step.id,
      details: { providerId: provider.id },
      ipAddress,
      userAgent,
    });

    return c.json({ url: link.url });
  } catch (err) {
    console.error("[Stripe Connect] Account creation/link generation failed:", err);
    return c.json({ error: "Payment setup temporarily unavailable" }, 503);
  }
});

// GET /stripe-status — check Connect account readiness
app.get("/stripe-status", requireProvider, async (c) => {
  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  if (!provider.stripeConnectAccountId) {
    return c.json({ error: "No Connect account" }, 404);
  }

  try {
    const account = await stripe.accounts.retrieve(provider.stripeConnectAccountId);

    if (account.charges_enabled) {
      // Find stripe_connect step
      const step = await db.query.onboardingSteps.findFirst({
        where: and(
          eq(onboardingSteps.providerId, provider.id),
          eq(onboardingSteps.stepType, "stripe_connect"),
        ),
      });

      if (step && isValidStepTransition(step.status, "complete")) {
        // Transition step to complete (TOCTOU guard)
        const [updated] = await db
          .update(onboardingSteps)
          .set({
            status: "complete",
            completedAt: new Date(),
            metadata: {
              ...(step.metadata as Record<string, unknown> || {}),
              chargesEnabledAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(onboardingSteps.id, step.id),
              eq(onboardingSteps.status, step.status),
            ),
          )
          .returning();

        if (updated) {
          logAudit({
            action: "stripe_connect.onboarding_completed",
            userId: user.id,
            resourceType: "onboarding_step",
            resourceId: step.id,
            details: {
              providerId: provider.id,
              source: "status_check",
            },
            ipAddress,
            userAgent,
          });

          broadcastToUser(user.id, {
            type: "onboarding:step_updated",
            data: {
              providerId: provider.id,
              stepType: "stripe_connect",
              newStatus: "complete",
            },
          });

          notifyStripeConnectCompleted(provider.id).catch((err) => {
            console.error("[Notifications] Failed:", err);
          });

          // All-steps-complete auto-transition check
          await checkAllStepsCompleteAndTransition(
            provider.id, step.id, "stripe_status_check",
            { userId: user.id, ipAddress, userAgent },
            provider,
          );
        }
      }

      return c.json({
        status: "complete",
        charges_enabled: true,
        details_submitted: account.details_submitted ?? true,
      });
    }

    return c.json({
      status: "pending",
      charges_enabled: false,
      details_submitted: account.details_submitted || false,
    });
  } catch (err) {
    console.error("[Stripe Connect] Status check failed:", err);
    return c.json({ error: "Payment status check temporarily unavailable" }, 503);
  }
});

// GET /stripe-dashboard — generate Express Dashboard login link
app.get("/stripe-dashboard", requireProvider, async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  if (!provider.stripeConnectAccountId) {
    return c.json({ error: "No Connect account" }, 404);
  }

  // Only allow access when stripe_connect step is complete
  const step = await db.query.onboardingSteps.findFirst({
    where: and(
      eq(onboardingSteps.providerId, provider.id),
      eq(onboardingSteps.stepType, "stripe_connect"),
    ),
  });

  if (!step || step.status !== "complete") {
    return c.json({ error: "Stripe Connect setup not complete" }, 403);
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(
      provider.stripeConnectAccountId,
    );
    return c.json({ url: loginLink.url });
  } catch (err) {
    console.error("[Stripe Connect] Dashboard link generation failed:", err);
    return c.json({ error: "Unable to generate dashboard link" }, 503);
  }
});

export default app;
