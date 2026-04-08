import { Hono } from "hono";
import { db } from "@/db";
import { providerPayouts, providers, bookings, services, payments } from "@/db/schema";
import { eq, desc, sql, and, inArray, isNull } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { markPayoutPaidSchema, initiateRefundSchema } from "@/lib/validators";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import { broadcastToAdmins } from "@/server/websocket/broadcast";
import { getStripe } from "@/lib/stripe";
import { MIGRATION_LAUNCH_DATE, MIGRATION_DEPRECATION_DAYS, MIGRATION_GRACE_PERIOD_DAYS } from "@/lib/constants";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAdmin);

const payoutStatusValues = ["pending", "paid", "clawback"] as const;
type PayoutStatus = (typeof payoutStatusValues)[number];
function isPayoutStatus(value: string): value is PayoutStatus {
  return payoutStatusValues.includes(value as PayoutStatus);
}

// List payouts with filters
app.get("/", async (c) => {
  const status = c.req.query("status");
  const providerId = c.req.query("providerId");

  const conditions = [];
  if (status) {
    if (isPayoutStatus(status)) {
      conditions.push(eq(providerPayouts.status, status));
    }
  }
  if (providerId) {
    conditions.push(eq(providerPayouts.providerId, providerId));
  }

  let query = db
    .select({
      payout: providerPayouts,
      provider: providers,
      booking: bookings,
      service: {
        name: services.name,
        category: services.category,
        commissionRate: services.commissionRate,
      },
    })
    .from(providerPayouts)
    .innerJoin(providers, eq(providerPayouts.providerId, providers.id))
    .innerJoin(bookings, eq(providerPayouts.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .orderBy(desc(providerPayouts.createdAt))
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query;

  // Attach deprecation warnings for providers approaching deadline
  let deprecationInfo: { deprecated: boolean; deprecationDate: string | null; graceEndDate: string | null } | undefined;
  if (MIGRATION_LAUNCH_DATE) {
    const deprecationDate = new Date(MIGRATION_LAUNCH_DATE.getTime() + MIGRATION_DEPRECATION_DAYS * 24 * 60 * 60 * 1000);
    const graceEndDate = new Date(deprecationDate.getTime() + MIGRATION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    deprecationInfo = {
      deprecated: now > deprecationDate,
      deprecationDate: deprecationDate.toISOString(),
      graceEndDate: graceEndDate.toISOString(),
    };
  }

  return c.json({ payouts: results, deprecationInfo });
});

// Batch mark payouts as paid
app.post("/mark-paid", async (c) => {
  const body = await c.req.json();
  const parsed = markPayoutPaidSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const now = new Date();
  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  // Atomic: deprecation enforcement + mark-paid + clawback settlement in single transaction
  let suspendedProviderIds: string[] = [];

  const txResult = await db.transaction(async (tx) => {
    let effectivePayoutIds = parsed.data.payoutIds;

    // Deprecation enforcement: reject manual payouts for non-Connect providers after deadline
    if (MIGRATION_LAUNCH_DATE) {
      const deprecationDate = new Date(MIGRATION_LAUNCH_DATE.getTime() + MIGRATION_DEPRECATION_DAYS * 24 * 60 * 60 * 1000);
      const graceEndDate = new Date(deprecationDate.getTime() + MIGRATION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      if (now > deprecationDate) {
        const payoutsWithProviders = await tx
          .select({ payoutId: providerPayouts.id, providerId: providerPayouts.providerId, connectAccountId: providers.stripeConnectAccountId })
          .from(providerPayouts)
          .innerJoin(providers, eq(providerPayouts.providerId, providers.id))
          .where(inArray(providerPayouts.id, effectivePayoutIds));

        const nonConnectPayouts = payoutsWithProviders.filter((p) => !p.connectAccountId);

        if (nonConnectPayouts.length > 0) {
          const isGracePeriod = now <= graceEndDate;

          if (!isGracePeriod || !parsed.data.override) {
            // Suspend non-compliant providers inside transaction
            const nonConnectProviderIds = [...new Set(nonConnectPayouts.map((p) => p.providerId))];
            for (const pid of nonConnectProviderIds) {
              await tx
                .update(providers)
                .set({
                  status: "suspended",
                  suspendedAt: now,
                  suspendedReason: "stripe_connect_not_completed",
                  updatedAt: now,
                })
                .where(and(eq(providers.id, pid), eq(providers.status, "active")));
            }
            suspendedProviderIds = nonConnectProviderIds;

            // Filter out non-Connect payouts
            const connectPayoutIds = payoutsWithProviders
              .filter((p) => p.connectAccountId)
              .map((p) => p.payoutId);

            if (connectPayoutIds.length === 0) {
              return { error: "deprecated" as const, suspendedProviders: nonConnectProviderIds };
            }

            effectivePayoutIds = connectPayoutIds;
          } else {
            // Grace period override used — audit it
            logAudit({
              action: "payout.manual_deprecated",
              userId: user.id,
              details: { reason: "grace_period_override_used", payoutIds: effectivePayoutIds },
              ipAddress,
              userAgent,
            });
          }
        }
      }
    }

    const updated = await tx
      .update(providerPayouts)
      .set({ status: "paid", paidAt: now })
      .where(
        and(
          inArray(providerPayouts.id, effectivePayoutIds),
          eq(providerPayouts.status, "pending"),
          eq(providerPayouts.payoutType, "standard")
        )
      )
      .returning();

    // Auto-settle outstanding clawback records for providers in this batch
    const providerIds = [...new Set(updated.map((p) => p.providerId))];
    let settled: typeof updated = [];
    if (providerIds.length > 0) {
      settled = await tx
        .update(providerPayouts)
        .set({ status: "paid", paidAt: now })
        .where(
          and(
            inArray(providerPayouts.providerId, providerIds),
            eq(providerPayouts.payoutType, "clawback"),
            eq(providerPayouts.status, "pending")
          )
        )
        .returning();
    }

    return { updated, settled };
  });

  // Handle deprecation rejection (returned from inside transaction)
  if ("error" in txResult && txResult.error === "deprecated") {
    // Audit suspensions (outside tx for fire-and-forget)
    for (const pid of suspendedProviderIds) {
      logAudit({
        action: "payout.manual_deprecated",
        userId: user.id,
        resourceType: "provider",
        resourceId: pid,
        details: { reason: "manual_payouts_deprecated" },
        ipAddress,
        userAgent,
      });
    }
    return c.json({
      error: "Manual payouts deprecated — provider must complete Stripe Connect setup",
      suspendedProviders: txResult.suspendedProviders,
    }, 403);
  }

  const { updated, settled } = txResult;

  // Audit each payout individually (NFR14 - immutable per-record, fire-and-forget)
  for (const payout of updated) {
    logAudit({
      action: "payout.mark_paid",
      userId: user.id,
      resourceType: "payout",
      resourceId: payout.id,
      details: { providerId: payout.providerId, bookingId: payout.bookingId, amount: payout.amount },
      ipAddress,
      userAgent,
    });
  }
  for (const cb of settled) {
    logAudit({
      action: "payout.mark_paid",
      userId: user.id,
      resourceType: "payout",
      resourceId: cb.id,
      details: { providerId: cb.providerId, bookingId: cb.bookingId, amount: cb.amount, type: "clawback_settled" },
      ipAddress,
      userAgent,
    });
  }

  // Broadcast to admins
  broadcastToAdmins({
    type: "payout:batch_paid",
    data: { payoutIds: updated.map((p) => p.id), count: updated.length },
  });

  return c.json({ updated: updated.length, payouts: updated, settledClawbacks: settled.length });
});

// Initiate refund (partial or full)
app.post("/refund", async (c) => {
  const body = await c.req.json();
  const parsed = initiateRefundSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { bookingId, type: refundType, amount: requestedAmount, reason } = parsed.data;
  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  // Wrap in transaction to prevent double-refund race condition (NFR34)
  const result = await db.transaction(async (tx) => {
    // Find confirmed payment for this booking
    const payment = await tx.query.payments.findFirst({
      where: and(eq(payments.bookingId, bookingId), eq(payments.status, "confirmed")),
    });
    if (!payment) {
      return { error: "No confirmed payment found for this booking", status: 404 } as const;
    }

    // Already refunded guard
    if (payment.refundAmount) {
      return { error: "Payment already refunded", status: 409 } as const;
    }

    // Calculate refund amount
    const refundAmount = refundType === "full" ? payment.amount : requestedAmount!;
    if (refundAmount > payment.amount) {
      return { error: "Refund amount exceeds payment amount", status: 400 } as const;
    }

    // H2: If Stripe payment, issue actual Stripe refund before updating DB
    if (payment.method === "stripe" && payment.stripePaymentIntentId) {
      try {
        await getStripe().refunds.create({
          payment_intent: payment.stripePaymentIntentId,
          amount: refundAmount,
        });
      } catch (err) {
        console.error("[Refund] Stripe refund API failed:", err);
        return { error: "Failed to process Stripe refund", status: 502 } as const;
      }
    } else if (payment.method === "stripe" && !payment.stripePaymentIntentId) {
      console.warn(`[Refund] Stripe payment ${payment.id} missing PaymentIntent ID — DB-only refund`);
    }

    // Update payment with refund info
    const [updatedPayment] = await tx
      .update(payments)
      .set({
        status: "refunded",
        refundAmount,
        refundedAt: new Date(),
        refundedBy: user.id,
        refundReason: reason,
      })
      .where(eq(payments.id, payment.id))
      .returning();

    // Handle payout adjustment
    const existingPayout = await tx.query.providerPayouts.findFirst({
      where: and(eq(providerPayouts.bookingId, bookingId), eq(providerPayouts.payoutType, "standard")),
    });

    let clawbackPayout = null;

    if (existingPayout) {
      if (existingPayout.status === "pending") {
        // Pending payout: adjust directly
        if (refundType === "full") {
          await tx
            .update(providerPayouts)
            .set({ amount: 0, notes: `Zeroed: full refund - ${reason}` })
            .where(eq(providerPayouts.id, existingPayout.id));
        } else {
          const refundRatio = refundAmount / payment.amount;
          const payoutReduction = Math.round(existingPayout.amount * refundRatio);
          const newPayoutAmount = Math.max(0, existingPayout.amount - payoutReduction);
          await tx
            .update(providerPayouts)
            .set({ amount: newPayoutAmount, notes: `Adjusted: partial refund (${Math.round(refundRatio * 100)}%) - ${reason}` })
            .where(eq(providerPayouts.id, existingPayout.id));
        }
      } else if (existingPayout.status === "paid") {
        // Already paid: create clawback record
        const clawbackAmount = refundType === "full"
          ? existingPayout.amount
          : Math.round(existingPayout.amount * (refundAmount / payment.amount));

        [clawbackPayout] = await tx
          .insert(providerPayouts)
          .values({
            providerId: existingPayout.providerId,
            bookingId,
            amount: -clawbackAmount, // negative amount
            status: "pending", // pending settlement in next batch
            payoutType: "clawback",
            originalPayoutId: existingPayout.id,
            paymentId: payment.id,
            notes: `Clawback: ${refundType} refund - ${reason}`,
          })
          .returning();

        // Audit clawback
        logAudit({
          action: "payout.clawback",
          userId: user.id,
          resourceType: "payout",
          resourceId: clawbackPayout.id,
          details: {
            originalPayoutId: existingPayout.id,
            clawbackAmount,
            refundType,
            bookingId,
          },
          ipAddress,
          userAgent,
        });
      }
    }

    return { ok: true, updatedPayment, existingPayout, clawbackPayout, refundAmount } as const;
  });

  // Handle early-return errors from transaction
  if ("error" in result) {
    return c.json({ error: result.error }, result.status);
  }

  const { updatedPayment, existingPayout, clawbackPayout, refundAmount } = result;

  // Audit refund (fire-and-forget, outside transaction)
  logAudit({
    action: "payment.refund",
    userId: user.id,
    resourceType: "payment",
    resourceId: updatedPayment.id,
    details: {
      bookingId,
      refundType,
      refundAmount,
      reason,
      hasClawback: !!clawbackPayout,
    },
    ipAddress,
    userAgent,
  });

  // Broadcast to admins
  broadcastToAdmins({
    type: "payment:refunded",
    data: { paymentId: updatedPayment.id, bookingId, refundType, refundAmount },
  });

  return c.json({
    refund: updatedPayment,
    payout: existingPayout ? { adjusted: true, clawback: clawbackPayout } : null,
  });
});

// Outstanding clawback balances per provider
app.get("/outstanding", async (c) => {
  const outstanding = await db
    .select({
      providerId: providerPayouts.providerId,
      providerName: providers.name,
      outstandingAmount: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
      clawbackCount: sql<number>`count(*)`,
    })
    .from(providerPayouts)
    .innerJoin(providers, eq(providerPayouts.providerId, providers.id))
    .where(and(
      eq(providerPayouts.payoutType, "clawback"),
      eq(providerPayouts.status, "pending")
    ))
    .groupBy(providerPayouts.providerId, providers.name);

  return c.json(outstanding.map((r) => ({
    providerId: r.providerId,
    providerName: r.providerName,
    outstandingAmount: Math.abs(Number(r.outstandingAmount)),
    clawbackCount: Number(r.clawbackCount),
  })));
});

// Aggregate summary with payout method breakdown
app.get("/summary", async (c) => {
  const [summary] = await db
    .select({
      totalPending: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'pending' and ${providerPayouts.payoutType} = 'standard' then ${providerPayouts.amount} else 0 end), 0)`,
      totalPaid: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'paid' then ${providerPayouts.amount} else 0 end), 0)`,
      pendingCount: sql<number>`count(case when ${providerPayouts.status} = 'pending' and ${providerPayouts.payoutType} = 'standard' then 1 end)`,
      paidCount: sql<number>`count(case when ${providerPayouts.status} = 'paid' then 1 end)`,
      totalClawback: sql<number>`coalesce(sum(case when ${providerPayouts.payoutType} = 'clawback' and ${providerPayouts.status} = 'pending' then abs(${providerPayouts.amount}) else 0 end), 0)`,
      clawbackCount: sql<number>`count(case when ${providerPayouts.payoutType} = 'clawback' and ${providerPayouts.status} = 'pending' then 1 end)`,
      // Payout method breakdown
      stripeConnectCount: sql<number>`count(case when ${providerPayouts.payoutMethod} = 'stripe_connect' and ${providerPayouts.status} = 'paid' then 1 end)`,
      stripeConnectTotal: sql<number>`coalesce(sum(case when ${providerPayouts.payoutMethod} = 'stripe_connect' and ${providerPayouts.status} = 'paid' then ${providerPayouts.amount} else 0 end), 0)`,
      manualBatchCount: sql<number>`count(case when ${providerPayouts.payoutMethod} = 'manual_batch' and ${providerPayouts.status} = 'paid' then 1 end)`,
      manualBatchTotal: sql<number>`coalesce(sum(case when ${providerPayouts.payoutMethod} = 'manual_batch' and ${providerPayouts.status} = 'paid' then ${providerPayouts.amount} else 0 end), 0)`,
    })
    .from(providerPayouts);

  // Pending migration: active providers without Connect who have pending payouts
  const pendingMigration = await db
    .select({
      count: sql<number>`count(distinct ${providers.id})`,
    })
    .from(providers)
    .innerJoin(providerPayouts, eq(providers.id, providerPayouts.providerId))
    .where(
      and(
        eq(providers.status, "active"),
        isNull(providers.stripeConnectAccountId),
        eq(providerPayouts.status, "pending"),
        eq(providerPayouts.payoutMethod, "manual_batch"),
      ),
    );

  return c.json({
    totalPending: Number(summary.totalPending),
    totalPaid: Number(summary.totalPaid),
    pendingCount: Number(summary.pendingCount),
    paidCount: Number(summary.paidCount),
    totalClawback: Number(summary.totalClawback),
    clawbackCount: Number(summary.clawbackCount),
    stripeConnect: {
      count: Number(summary.stripeConnectCount),
      total: Number(summary.stripeConnectTotal),
    },
    manualBatch: {
      count: Number(summary.manualBatchCount),
      total: Number(summary.manualBatchTotal),
    },
    pendingMigration: {
      providers: Number(pendingMigration[0]?.count || 0),
    },
  });
});

export default app;
