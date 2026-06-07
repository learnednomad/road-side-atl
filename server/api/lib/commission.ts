/**
 * Commission resolution — the platform's cut (basis points) for a booking,
 * by scope precedence: account > provider > service > global, then priority.
 *
 * Fail-open: returns null on any error or when no rule matches, so the legacy
 * commission logic in computeProviderAmount applies (an empty rules table = no
 * behavior change). Both the payout record and the checkout application fee call
 * this with the SAME inputs, so the B2 invariant (transfer == recorded payout)
 * holds.
 */
import { db } from "@/db";
import { commissionRules } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";

const SCOPE_RANK: Record<string, number> = { account: 3, provider: 2, service: 1, global: 0 };

export async function resolveCommissionBp(params: {
  accountId?: string | null;
  providerId?: string | null;
  serviceId?: string | null;
}): Promise<number | null> {
  try {
    const scopeConds = [eq(commissionRules.scope, "global")];
    if (params.accountId)
      scopeConds.push(and(eq(commissionRules.scope, "account"), eq(commissionRules.scopeId, params.accountId))!);
    if (params.providerId)
      scopeConds.push(and(eq(commissionRules.scope, "provider"), eq(commissionRules.scopeId, params.providerId))!);
    if (params.serviceId)
      scopeConds.push(and(eq(commissionRules.scope, "service"), eq(commissionRules.scopeId, params.serviceId))!);

    const rules = await db
      .select()
      .from(commissionRules)
      .where(and(eq(commissionRules.active, true), or(...scopeConds)));

    if (rules.length === 0) return null;
    rules.sort(
      (a, b) => (SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope]) || b.priority - a.priority,
    );
    return rules[0].commissionRateBp;
  } catch (err) {
    console.error("[commission] resolve failed — falling back to legacy logic:", err);
    return null;
  }
}
