import { Hono } from "hono";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { providers } from "@/db/schema/providers";
import { onboardingSteps } from "@/db/schema/onboarding-steps";
import { providerInvites } from "@/db/schema/provider-invites";
import { eq, and, isNull, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { providerApplicationSchema, inviteAcceptSchema, providerStepUpdateSchema } from "@/lib/validators";
import { ONBOARDING_STEP_TYPES, REAPPLY_COOLDOWN_DAYS } from "@/lib/constants";
import { isValidProviderTransition, isValidStepTransition } from "../lib/onboarding-state-machine";
import { rateLimitStrict } from "../middleware/rate-limit";
import { requireProvider } from "../middleware/auth";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import { broadcastToUser } from "@/server/websocket/broadcast";

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
    }

    return c.json({
      steps: safeSteps,
      provider: {
        status: "pending_review",
        name: provider.name,
        completedStepsCount,
        totalSteps,
      },
    });
  }

  return c.json({
    steps: safeSteps,
    provider: {
      status: provider.status,
      name: provider.name,
      completedStepsCount,
      totalSteps,
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

// POST /apply — public provider application
app.post("/apply", async (c) => {
  const body = await c.req.json();
  const parsed = providerApplicationSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { name, email, password, phone, serviceArea, specialties } = parsed.data;
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
  }

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

export default app;
