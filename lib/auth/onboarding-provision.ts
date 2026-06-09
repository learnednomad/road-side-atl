import { db } from "@/db";
import { providers } from "@/db/schema/providers";
import { onboardingSteps } from "@/db/schema/onboarding-steps";
import { createId } from "@/db/schema/utils";
import { ONBOARDING_STEP_TYPES } from "@/lib/constants";
import { eq } from "drizzle-orm";

/**
 * Provision a provider's onboarding once they are eligible to begin (e.g. their
 * email is verified). Moves a `pending` provider into `onboarding` and creates
 * their step checklist if it doesn't exist yet.
 *
 * Idempotent and safe to call repeatedly: it no-ops for non-providers, for
 * providers past the `pending` stage, and never duplicates steps.
 *
 * Self-registered providers (server/api/routes/provider-registration.ts) are
 * created with status `pending` and NO steps; without this, they were stuck on
 * an empty "0 of 0 steps" dashboard forever. Invited providers are provisioned
 * separately in provider-invite.ts at invite-acceptance time.
 */
export async function provisionProviderOnboarding(userId: string): Promise<void> {
  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, userId),
  });

  // Not a provider, or already onboarding/active/etc. — nothing to do.
  if (!provider || provider.status !== "pending") return;

  const existingStep = await db.query.onboardingSteps.findFirst({
    where: eq(onboardingSteps.providerId, provider.id),
  });

  if (!existingStep) {
    await db.insert(onboardingSteps).values(
      ONBOARDING_STEP_TYPES.map((stepType) => ({
        id: createId(),
        providerId: provider.id,
        stepType,
        status: "pending" as const,
      }))
    );
  }

  await db
    .update(providers)
    .set({ status: "onboarding", updatedAt: new Date() })
    .where(eq(providers.id, provider.id));
}
