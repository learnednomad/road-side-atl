# Changelog

All notable changes to RoadSide GA are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased] - Stripe Integration Overhaul

### Summary

Comprehensive Stripe integration across onboarding, pricing, payouts, identity verification, and platform financial operations. Migrates from platform-side charges to destination charges, replaces all reconciliation stubs with real implementations, and adds feature flag system for safe rollout.

---

### Added

#### Destination Charges (Phase 1)
- Migrate checkout from platform charges to **Stripe destination charges** with `application_fee_amount` — funds split instantly at charge time
- Fallback to legacy platform charge for providers without Connect accounts
- Capture `chargeType`, `applicationFeeAmount`, `stripeConnectAccountId`, `stripeTransferId` on payment records for full traceability
- Webhook handler retrieves and stores auto-created transfer ID on `checkout.session.completed`

#### Real Stripe Connect Payouts (Phase 1)
- `createPayoutIfEligible()` now issues real `stripe.transfers.create()` with idempotency keys for legacy platform charges
- Destination charges auto-record payouts as `paid` (Stripe already handled the split)
- `migratePendingPayoutsToConnect()` fully implemented — migrates pending manual_batch payouts to Stripe transfers when provider completes Connect onboarding
- Transfer failure falls back to `manual_batch` with error logged in metadata

#### Reconciliation Cron Jobs (Phase 1) — All 6 Stubs Replaced
- `reconcileCheckrStatuses()` — polls Checkr API for background checks stuck in `in_progress`
- `reconcileStripeConnectStatuses()` — polls `stripe.accounts.retrieve()`, fixes drift between Stripe and onboarding steps
- `checkStripeConnectAbandonment()` — sends 48h and 7-day reminder notifications for stalled Connect onboarding
- `enforceStripeConnectDeadline()` — auto-suspends providers who haven't completed Connect setup within 30 days
- `checkMigrationReminders()` — sends Day 0/14/25 migration reminders to providers still on manual_batch
- `enforceMigrationDeadline()` — suspends non-compliant providers after deprecation + grace period

#### Feature Flags System (Phase 1)
- `server/api/lib/feature-flags.ts` — backed by `platform_settings` table with 1-minute in-memory cache
- 11 flags with sensible defaults (dangerous features OFF by default)
- Admin API: `GET/PUT /api/admin/feature-flags/:key` with audit logging
- All reconciliation cron jobs and destination charges gated by feature flags

#### Automated Payout Scheduling (Phase 2)
- New `processPendingPayouts()` daily cron — batch-processes pending `stripe_connect` payouts

#### Payout Holds for Disputes (Phase 2)
- `charge.dispute.created` webhook freezes pending payouts to `held` status
- `charge.dispute.updated` (won) releases hold back to `pending`
- `charge.dispute.updated` (lost) creates clawback record for already-paid payouts, cancels held payouts

#### Provider Earnings Dashboard (Phase 2)
- `GET /api/provider/earnings/summary` — this week, this month, all-time, pending, held, clawbacks, total jobs
- `GET /api/provider/earnings/history` — paginated payout list with full status metadata
- `GET /api/provider/earnings/pending` — pending + held payouts

#### Stripe Identity Verification (Phase 2)
- New `identity_verification` onboarding step type
- `POST /api/onboarding/identity/start` — creates Stripe VerificationSession with selfie matching
- `GET /api/onboarding/identity/status` — checks Stripe session status
- Webhook handlers: `identity.verification_session.verified` marks step complete, `requires_input` stores error info
- Feature-flagged (OFF by default)

#### Tax Reporting — 1099-K (Phase 2)
- `GET /api/provider/tax-forms` — generates Stripe Express Dashboard login link for tax form access

#### Financial Reconciliation Reporting (Phase 2)
- `reconcilePaymentsAndPayouts()` daily cron — flags orphan payments, orphan payouts, amount mismatches
- `GET /api/admin/financial-reports/reconciliation` — on-demand payment-payout match report
- `GET /api/admin/financial-reports/stripe-balance` — DB totals vs `stripe.balance.retrieve()`

#### Demand-Based Surge Pricing (Phase 2)
- Composable pricing pipeline: base price -> time-block -> demand surge -> scarcity
- `surge_configs` table with configurable threshold, step, and max multiplier
- Sliding 60-minute window demand algorithm
- 3x price ceiling guardrail
- Full breakdown in pricing response: `{ breakdown: [...], surgeActive, surgeMultiplierBp }`
- Feature-flagged (OFF by default)

#### Stripe Radar & Fraud Prevention (Phase 2)
- Documented recommended Radar rules for marketplace fraud patterns

#### Customer Payment Method Management (Phase 3)
- `POST /api/payment-methods/setup-intent` — save cards via Stripe SetupIntent (Apple Pay/Google Pay via `automatic_payment_methods`)
- `GET /api/payment-methods` — list saved cards with brand, last4, default status
- `DELETE /api/payment-methods/:id` — detach with ownership verification
- `PUT /api/payment-methods/default` — set default, syncs to Stripe customer

#### Trust Tier Auto-Promotion/Demotion (Phase 3)
- `evaluateTrustTierPromotions()` daily cron — batch promotes tier 1 to 2 when threshold met
- `demoteTrustTier()` auto-demotes on `charge.dispute.created`
- Tracks `trustTierUpdatedAt` and `trustTierReason` on user record

#### Instant Payouts for Providers (Phase 3)
- `GET /api/provider/instant-payout/eligibility` — checks instant_available balance
- `POST /api/provider/instant-payout` — triggers `stripe.payouts.create({ method: 'instant' })` on connected account
- 1.5% fee (Stripe's rate), max 10/day, 24/7 availability
- Feature-flagged (OFF by default)

#### Payout Schedule Preferences (Phase 3)
- `GET /api/provider/payout-settings` — reads current schedule from Stripe
- `PUT /api/provider/payout-settings` — updates via Balance Settings API (daily/weekly/monthly)

#### Weather-Based Pricing (Phase 3)
- `server/api/lib/weather-pricing.ts` — OpenWeatherMap integration with 15-minute cache
- Multipliers: Clear=1.0x, Rain=1.1x, Thunderstorm=1.25x, Snow=1.5x
- Graceful fallback to 1.0x on API failure

#### Geographic Zone Pricing (Phase 3)
- `pricing_zones` table with GeoJSON polygons and base multipliers

#### Promotional Pricing (Phase 3)
- `allow_promotion_codes: true` enabled on Stripe Checkout sessions
- `promotions` table backed by Stripe Coupons + Promotion Codes
- Admin API: `POST/GET/DELETE /api/admin/promotions`

#### Service Bundling (Phase 4)
- `service_bundles` table with serviceIds (JSONB), bundlePrice, auto-calculated savings
- Admin CRUD: `GET/POST/PUT/DELETE /api/admin/bundles`
- `GET /api/admin/bundles/active` for customer-facing display

#### Provider Availability-Based Pricing (Phase 4)
- Scarcity multiplier in pricing pipeline when < 3 providers available
- 5% increase per missing provider, capped at 1.5x

#### Customer Identity Verification (Phase 4)
- Stripe Identity for customers on bookings > $500
- `POST /api/payment-methods/identity/start` and `GET .../identity/status`
- Feature-flagged (OFF by default)

#### Provider Re-verification Cycles (Phase 4)
- `checkProviderReverification()` daily cron — resets completed verification steps older than 365 days
- Applies to: identity_verification, background_check, insurance, certifications
- Tracks cycle count and previous completion in metadata

### Changed

- `payments.ts` checkout route now uses destination charges when provider has Connect account (feature-flagged)
- `payout-calculator.ts` completely rewritten — handles destination charges (auto-paid), legacy transfers, and manual batch
- `pricing-engine.ts` restructured to composable multiplier pipeline with surge + scarcity steps
- `webhooks.ts` enhanced with Identity event handlers, payout hold/release on disputes, transfer ID capture
- `reconciliation.ts` completely rewritten — all 6 stubs replaced with real implementations + 3 new functions
- `trust-tier.ts` gains `demoteTrustTier()` and `evaluateTrustTierPromotions()` for automated lifecycle
- `payoutStatusEnum` gains `"held"` value for dispute freezes
- `stepTypeEnum` gains `"identity_verification"` for Stripe Identity onboarding step

### Database Migrations

| Migration | Description |
|-----------|-------------|
| `0024_add_payout_transfer_and_hold.sql` | `provider_payouts`: stripeTransferId, holdReason, heldAt, "held" status. `payments`: stripeTransferId, applicationFeeAmount, chargeType, stripeConnectAccountId |
| `0025_phase2_surge_and_identity.sql` | `surge_configs` and `pricing_adjustments_log` tables, `identity_verification` step type, default surge config seed |
| `0026_phase3_methods_zones_promos.sql` | `users`: defaultPaymentMethodId, trustTierUpdatedAt, trustTierReason. `pricing_zones` and `promotions` tables |
| `0027_phase4_bundles.sql` | `service_bundles` table |

### New Files

| File | Purpose |
|------|---------|
| `server/api/lib/feature-flags.ts` | Feature flag system with DB-backed cache |
| `server/api/lib/weather-pricing.ts` | OpenWeatherMap pricing integration |
| `server/api/routes/admin-feature-flags.ts` | Feature flag admin API |
| `server/api/routes/admin-promotions.ts` | Stripe Coupons admin API |
| `server/api/routes/admin-bundles.ts` | Service bundle admin API |
| `server/api/routes/payment-methods.ts` | Customer payment method + identity API |
| `db/schema/surge-pricing.ts` | Surge configs + pricing adjustments log |
| `db/schema/pricing-zones.ts` | Geographic zones + promotions |
| `db/schema/service-bundles.ts` | Service bundles |

### Cron Jobs Added

| Job | Interval | Purpose |
|-----|----------|---------|
| `process-pending-payouts` | 24h | Batch-process pending Stripe Connect payouts |
| `reconcile-payments-payouts` | 24h | Match payments to payouts, flag discrepancies |
| `trust-tier-evaluation` | 24h | Batch promote eligible tier-1 users |
| `provider-reverification` | 24h | Reset expired verification steps for annual re-verification |

### Feature Flags

| Flag | Default | Controls |
|------|---------|----------|
| `checkr_reconciliation` | OFF | Checkr background check polling |
| `stripe_connect_reconciliation` | ON | Stripe Connect status sync |
| `stripe_connect_abandonment` | ON | Abandonment reminders |
| `stripe_connect_deadline` | OFF | Auto-suspend past deadline |
| `migration_reminders` | OFF | Manual-to-Connect migration nudges |
| `migration_deadline` | OFF | Auto-suspend non-migrated providers |
| `destination_charges` | ON | Destination charges vs platform charges |
| `surge_pricing` | OFF | Dynamic demand-based surge pricing |
| `stripe_identity` | OFF | Provider identity verification |
| `instant_payouts` | OFF | Provider instant payouts |
| `customer_identity_verification` | OFF | Customer ID check for high-value bookings |
