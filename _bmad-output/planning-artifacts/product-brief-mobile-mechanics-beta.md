---
title: "Product Brief: Mobile Mechanics as a Service + Open Beta"
status: "complete"
created: "2026-04-07"
updated: "2026-04-07"
inputs:
  - _bmad-output/planning-artifacts/product-brief-road-side-atl-2026-02-11.md
  - docs/project-overview.md
  - docs/feature-catalog-technical.md
  - db/schema/services.ts
  - db/schema/providers.ts
  - server/api/lib/auto-dispatch.ts
  - server/api/lib/trust-tier.ts
---

# Product Brief: Mobile Mechanics as a Service + Open Beta

## Executive Summary

RoadSide GA has proven the core loop: 60-second booking, auto-dispatch, real-time tracking, flexible payment. Six services across roadside and diagnostics are live. The provider portal works. The admin dashboard works. The platform handles bookings end-to-end.

Now we're adding **Front Door 3: Mobile Mechanics** — scheduled, on-site auto repair and maintenance. Oil changes in your driveway. Brake pads in your office parking lot. Battery replacements wherever you are. No shop visit. No waiting room. No half-day off work. This isn't emergency rescue — it's **convenience maintenance brought to you**, and it's the natural evolution of the same trust relationship: "Can I trust my car?"

We're launching this alongside a **2-month open beta (April 7 – June 7, 2026)** with zero gates. No invite codes. No subscriptions. No trust tier restrictions. Anyone can sign up, book any service, pay any way. The goal: validate the mobile mechanics market, stress-test the platform under real usage, and build a beta user base we convert post-launch.

Simultaneously, we're closing the **mobile app gap**. The Expo/React Native app exists but is incomplete — missing reviews, referrals, observations, inspection reports, push notifications, and real-time tracking. Beta testing a service platform without a complete mobile experience is testing with one hand tied. Everything a web user can do, a mobile user must be able to do.

## The Problem

**The mechanic shop model is broken for routine maintenance.** You need an oil change. That means: research shops, call for availability, drive there, wait 45 minutes in a fluorescent-lit lobby watching cable news, drive back. For brake pads, block off half a day. For a battery, pray it dies somewhere convenient. Americans spend an average of 2-3 hours per maintenance visit — not because the work takes that long, but because the logistics do.

**The alternative is worse.** Mobile mechanics exist on Craigslist and Facebook groups. No standardized pricing. No reviews. No accountability. No professional job management. The average consumer has no way to evaluate quality, and the average independent mechanic has no way to build a professional digital presence.

**Meanwhile, our existing platform has supply sitting idle.** Providers who handle roadside calls have downtime between emergencies. Mechanic-certified providers want scheduled work to fill their day. The dispatch infrastructure, payment system, and provider management tools already exist. The marginal cost of adding a mechanic service category is a fraction of building from scratch.

**And the mobile app can't keep up.** Providers in the field need to accept jobs, update status, submit observations, and track earnings from their phone — not a laptop. Customers waiting for a mechanic want push notifications and a live map, not a browser tab they have to keep refreshing. The web-only experience is a friction point that will kill beta retention.

## The Solution

### Mobile Mechanics Service Category

Add a third service category — `mechanics` — alongside existing `roadside` and `diagnostics`. Six new services, all **scheduled-only** (no emergency dispatch):

| Service | Price | What It Includes |
|---------|-------|------------------|
| Oil Change | $75 | Conventional or synthetic, filter, fluid top-off |
| Brake Pad Replacement | $150 | Front or rear, includes pad set |
| Battery Replacement | $120 | Test + replace, includes battery |
| General Maintenance | $95 | Multi-point inspection + minor fixes |
| AC Repair & Recharge | $130 | Leak check + refrigerant recharge |
| Belt Replacement | $110 | Serpentine or timing belt |

Mechanics come to the customer's location. Bookings require a scheduled date/time — no "ASAP" option. Dispatch fires via cron job 2 hours before the appointment, matching providers with `mechanics` specialty.

**Parts model:** Providers supply their own parts and consumables. Service prices are set to cover provider travel, labor, AND standard parts (conventional oil + filter for oil change, standard pad set for brakes, etc.). Premium parts (synthetic oil, ceramic pads) are handled via the existing price override mechanism — provider notes the upgrade, admin adjusts the final price. This keeps the platform out of inventory management during beta. Post-beta, a parts markup layer can be introduced once volume justifies it.

| Service | Provider Keeps (75%) | Platform Takes (25%) | Parts Est. |
|---------|---------------------|---------------------|------------|
| Oil Change ($75) | $56.25 | $18.75 | ~$25-35 |
| Brake Pads ($150) | $112.50 | $37.50 | ~$30-50 |
| Battery ($120) | $90.00 | $30.00 | ~$40-60 |

Provider net after parts: $20-30/job for oil changes, $60-80 for brakes, $30-50 for batteries — plus they fill idle time between emergency calls. Sustainable at beta volume; pricing adjusts post-beta based on real cost data.

### Open Beta (Zero Gates)

For 2 months, the platform runs fully open:
- **No trust tier restrictions** — all payment methods available to all users from day one
- **No invite codes or waitlists** — organic sign-up, anyone can book
- **Normal pricing applies** — we're testing willingness to pay, not just feature usage
- **Beta user tracking** — every user who books during beta is enrolled for post-beta conversion campaigns

Implementation: 3 rows in the existing `platform_settings` table. One helper function. One trust-tier bypass check. Admin flips a switch to end beta. No feature flag system, no subscription infrastructure.

### Full Mobile App Parity

Close every gap between web and mobile:
- **Provider**: Accept/reject jobs, update status, GPS location tracking, submit observations, file inspection reports
- **Customer**: Full booking flow (including new mechanic services with date picker), real-time tracking map, reviews, referral sharing
- **Notifications**: Expo push notifications for job assignments, status changes, dispatch alerts
- **Referrals**: Share referral code via native share sheet, view credits, deep link handling

## What Makes This Different

1. **Existing infrastructure, new revenue stream.** We're not building a mobile mechanic platform from zero. The booking system, dispatch engine, payment processing, provider management, and admin tools exist. Adding `mechanics` is a category expansion, not a rebuild.

2. **Scheduled + Emergency on one platform.** No competitor serves both "my car broke down right now" and "I need an oil change next Tuesday" through the same provider network and customer relationship. TaskRabbit doesn't do cars. YourMechanic doesn't do emergency roadside. We do both.

3. **Provider supply — recruited, not assumed.** Current roadside providers are tow operators and light-service drivers. Mechanic services require ASE-certified or experienced wrench-turners — a different supply profile. Beta provider recruitment targets three pools: (a) existing providers who also hold mechanic certs (survey the current base), (b) independent mobile mechanics already working Craigslist/Facebook with no platform (direct outreach, "bring your customers, keep more money"), (c) shop mechanics looking for side income on days off. Goal: 5-10 mechanic-capable providers in the Atlanta metro before first customer booking goes live. Provider onboarding for mechanics uses the existing registration flow with `mechanics` added to their `specialties` array.

4. **Observation pipeline = organic upsell engine.** The existing Vehicle Observation Pipeline is the strongest acquisition channel for mechanic bookings. Provider does a jump start, notices worn brake pads, logs a medium-severity observation. System auto-sends follow-up: "Your provider noticed your brakes need attention. Book a mobile brake service — we come to you." This turns every roadside call into a potential mechanic booking at zero acquisition cost.

5. **Zero-gate beta is a competitive weapon.** While competitors require memberships, subscriptions, or friction-heavy onboarding, we let anyone use everything immediately. Beta users become the word-of-mouth engine.

## Who This Serves

**New: The Convenience Maintainer** — Professional who doesn't have time to sit in a shop. Books an oil change for Saturday at 10 AM in their driveway. Mechanic arrives, does the work, leaves. Total time investment: signing a 60-second booking form.

**Existing: Providers seeking more revenue** — Already on the platform doing roadside calls. Adding mechanic services means scheduled work between emergencies. Predictable income alongside on-demand income.

**New: B2B Fleet Maintenance** — Delivery companies, rideshare fleet managers, and apartment complexes with company vehicles need routine maintenance without taking vehicles off the road. A fleet oil change contract (10 vehicles/month at $65/each) is predictable recurring revenue and the fastest path to beta volume. Existing B2B account infrastructure supports this immediately — contract pricing via `perJobRateCents` override, monthly invoicing already built.

**Existing: All current user personas** — Stranded commuters, used car buyers/sellers, rideshare drivers, B2B accounts. They all benefit from mobile parity and the expanded service catalog. The observation-to-mechanic upsell funnel turns every existing roadside customer into a warm lead for mechanic services.

## Success Criteria (Beta Period)

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Mechanic service bookings | 50+ during beta | Validates demand for the new category |
| Beta user sign-ups | 200+ | Size of conversion cohort post-beta |
| Mobile app booking completion rate | >70% | Proves mobile parity is working |
| Provider mechanic job acceptance rate | >80% | Supply-side validation |
| Push notification opt-in rate | >60% | Engagement channel health |
| NPS from beta users | >40 | Overall experience quality |

## Scope

### In (Beta Period)
- `mechanics` service category with 6 services
- Scheduling-only booking enforcement for mechanic services
- Beta mode config (platform_settings-based, admin toggle)
- Trust tier bypass during beta
- Beta user tracking table
- Full mobile app parity: provider jobs, customer booking, push notifications, real-time tracking, reviews, referrals, observations, inspections
- Mechanic pre-dispatch cron (2hrs before scheduled time)
- Expo push notification infrastructure

### Out (Post-Beta / Future)
- Subscription tiers or premium membership
- Parts ordering / inventory management
- In-app mechanic-customer chat
- Multi-city expansion (Atlanta only)
- Mechanic certification verification system
- Customer-uploaded vehicle maintenance history
- Warranty or guarantee programs for mechanic services

## Vision

If the beta validates demand, mobile mechanics becomes RoadSide GA's **third revenue pillar** — recurring, scheduled, higher-LTV than emergency roadside. The mechanic who changes your oil becomes the same person you call when your car breaks down. One platform, one trust relationship, every vehicle need.

Post-beta: introduce mechanic subscription packages (3 oil changes + 1 inspection/year), B2B fleet maintenance contracts, and parts markup as a revenue layer. The scheduled mechanic model has 3-5x higher repeat rate than emergency roadside — this is where retention lives.
