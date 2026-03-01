---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-road-side-atl-2026-02-11.md
  - _bmad-output/brainstorming/brainstorming-session-2026-02-11.md
  - docs/index.md
  - docs/project-overview.md
  - docs/project-context.md
  - docs/architecture.md
  - docs/data-models.md
  - docs/api-contracts.md
  - docs/source-tree-analysis.md
  - docs/component-inventory.md
  - docs/development-guide.md
  - docs/deployment-guide.md
  - _bmad-output/project-context.md
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 1
  projectDocs: 8
  projectContext: 2
classification:
  projectType: Real-Time Marketplace Platform
  domain: Emergency On-Demand Services
  complexity: Medium-High
  projectContext: Brownfield — Feature Expansion
---

# Product Requirements Document - road-side-atl

**Author:** Beel
**Date:** 2026-02-11

## Executive Summary

### Vision

RoadSide ATL is a 24/7 on-demand roadside assistance marketplace serving the Atlanta metro area. The platform connects stranded drivers and used car buyers with vetted local providers through real-time GPS dispatch and live tracking — delivering sub-15-minute response times that beat AAA's 21-23-minute metro average by 30%+.

### Product Differentiator

**Two Front Doors, One Platform:**
- **Front Door 1 (Emergency Rescue):** Jump starts, tire changes, lockouts, towing, fuel delivery — immediate dispatch with live tracking
- **Front Door 2 (Vehicle Diagnostics):** Pre-purchase inspections with branded PDF reports — scheduled appointments with tiered products ($250/$325/$400)

No competitor combines real-time emergency dispatch with scheduled vehicle diagnostics. AAA and Agero handle emergencies only. YourMechanic and mobile mechanics don't build dispatch marketplaces. RoadSide ATL owns the intersection.

### Target Users

| User | Role | Value |
|---|---|---|
| Stranded drivers | B2C emergency customers | Core demand, referral engine |
| Used car buyers/sellers | B2C diagnostic customers | Blue ocean, high-margin |
| Rideshare drivers | Customer → Provider → Subscriber → Recruiter | $1,679/year quadruple-value flywheel |
| Dealerships, apartments, fleets | B2B contract accounts | Revenue floor ($6-10K/month), cold-start solver |
| Independent tow operators, mechanics | Providers | Supply side, 70-80% payout |

### Key Innovation

**Trust Tier Payment System** eliminates chargebacks structurally: new customers restricted to non-reversible methods (Cash, CashApp, Zelle) until earning card access through clean completions. **B2B-First Launch** inverts the standard marketplace playbook — contract revenue funds operations before consumer scale, eliminating venture dependency.

### Technical Foundation

Next.js 16 + Hono API + Drizzle ORM + PostgreSQL 16 + WebSocket. Deployed on Coolify VPS. 85% of platform already built — MVP adds 9 features (~7-9 dev days) on the existing brownfield codebase.

## Success Criteria

### User Success

**The Stranded Driver (B2C Emergency)**

| Criteria | Target | Evidence |
|---|---|---|
| Time-to-help (booking → provider arrival) | **< 15 min ITP, < 25 min OTP** | AAA averages 21-23 min in metro areas (J.D. Power). Beating AAA by 30%+ is the positioning — "3x faster" only works if you actually are. |
| Booking completion rate | **> 85%** | 53% of mobile users bounce if page takes > 3 seconds to load (Google). Stranded drivers on 12% battery and spotty I-285 signal need a sub-60-second flow on a sub-2-second page. |
| First-service resolution (no escalation) | **> 90%** | Industry standard for dispatch accuracy. Below 85% means your auto-dispatch algorithm is guessing wrong — provider shows up without the right equipment. |
| Post-service referral share rate | **> 25%** | Benchmark: best-in-class on-demand apps see 20-30% organic sharing. Roadside has a built-in storytelling moment — "you won't believe how fast they showed up." |
| Repeat customer rate (2+ services / 12 months) | **> 30%** | Average driver experiences 3-5 breakdowns per vehicle lifetime (AAA). A 30% repeat rate means they're coming back vs. Googling again next time. |
| NPS | **> 50** | Insurance industry average NPS is 36 (ClearlyRated 2024). Agero data shows timely roadside support lifts NPS by ~20%. Sub-15-minute response with live tracking should clear 50+ easily. |

**The Used Car Buyer/Seller (B2C Diagnostics)**

| Criteria | Target | Evidence |
|---|---|---|
| Inspection report delivery | **< 2 hours post-completion** | No established benchmark — this IS the benchmark. Mobile mechanics on Craigslist don't provide reports at all. |
| Report satisfaction (rated useful) | **> 90%** | Up to 25% of used cars have hidden issues (Carfax), 1 in 6 have unresolved safety recalls. If your report catches even one of these, it's worth $250. |
| Diagnostic booking volume | **> 10/month by Month 3** | ~28K private-party car sales/month in Atlanta metro (Cox Automotive data, population-adjusted). 10 bookings = 0.04% penetration. If you can't hit that, the demand signal is weak. |

**B2B Accounts**

| Criteria | Target | Evidence |
|---|---|---|
| Contract retention (annual renewal) | **> 85%** | SaaS B2B retention benchmark is 90%+ (ChurnRX). Service contracts run lower at 80-85%. If you're under 80%, your service isn't embedded — it's optional. |
| Priority dispatch response | **< 12 min** | Must be measurably faster than consumer response. Contract accounts paying $250-500/month expect VIP treatment. 12 min is 40% faster than your consumer ITP target. |
| Apartment resident → personal customer conversion | **> 40%** | Every parking deck rescue is a customer acquired at $0 CAC. At the apartment contract rate of $250/month serving ~5 residents, that's effectively paying $50/customer acquired — with a guaranteed first experience. |
| B2B revenue as % of total (Phase 1-2) | **> 40%** | Marketplace cold-start best practice: constrain the supply-side problem by locking in predictable demand first (Andrew Chen, a16z). B2B contracts are your revenue floor while consumer demand ramps. |

**Providers**

| Criteria | Target | Evidence |
|---|---|---|
| 90-day retention | **> 70%** | Uber retains ~66% at 90 days (estimated from 13%/month churn). Only 4% of Uber drivers remain after 12 months (CNBC/Stanford). Your advantage: providers earn 70-80% of job value vs. Uber's 70-75% after fees. If you can't beat Uber's retention with better economics, the model is broken. |
| Monthly earnings (heavy-service) | **> $800/month** | A tow truck payment is $1,200/month (your persona). Platform revenue needs to meaningfully offset fixed costs, not be pocket change. |
| Monthly earnings (light-service) | **> $400/month** | Rideshare drivers earn $15-25/hour. 20 hours/month of platform work at $20/hour = $400. Must be competitive with just driving Uber during the same hours. |
| Job acceptance rate (first dispatch) | **> 75%** | Below 75% means the dispatch algorithm is sending jobs too far away, wrong service type, or wrong time. Every rejected dispatch adds 3-5 minutes to customer wait time. |
| Provider rating average | **> 4.5 / 5** | Uber deactivates below 4.6. Maintaining 4.5+ proves quality scales with the network. |

### Business Success

**Revenue Targets (Evidence-Based)**

| Phase | Monthly Revenue | Basis |
|---|---|---|
| **Survive** (Month 1-2) | $6,000-10,000 | 3 B2B contracts ($250-500/month each = $1,000-1,500) + 5-10 bookings/week × $100 avg × 25% take = $500-1,000/month B2C. Conservative. |
| **Foundation** (Month 2-4) | $12,000-18,000 | 6 B2B contracts ($3,000-4,000/month) + 15-30 bookings/week × $110 avg × 25% take. B2B is the floor; B2C is the growth. |
| **Growth** (Month 4-8) | $25,000-40,000 | 10+ B2B contracts + 40-75 bookings/week + subscription MRR kicking in. a16z benchmark: 15-20% MoM GMV growth for healthy early-stage marketplaces. |
| **Dominance** (Month 8-12) | $50,000-80,000 | $600K-960K annual run rate. At 25% blended take rate, platform processes $200-320K/month GMV. For context, Series A marketplace benchmark is $500K-2M monthly GMV (Qubit Capital). |

**North Star Metric: Bookings Completed Per Week**

| Phase | Target | Implied Daily |
|---|---|---|
| Month 1-2 | 5-10/week | ~1-2/day |
| Month 2-4 | 15-30/week | ~3-5/day |
| Month 4-8 | 40-75/week | ~6-11/day |
| Month 8-12 | 100-150/week | ~15-22/day |

Context: Georgia HERO program assists 4,000+ motorists/month on metro Atlanta interstates alone (GDOT). That's government-funded free service on highways only — doesn't cover parking lots, residential areas, or non-interstate roads. The total addressable breakdown volume in Atlanta metro is multiples of that. Capturing 150 bookings/week by Month 12 is < 4% of just the interstate-only HERO volume.

**Unit Economics**

| Metric | Target | Industry Benchmark |
|---|---|---|
| Platform take rate | **25% blended** (30% basic / 25% standard / 20% premium) | Service marketplaces cluster at 15-25% (TaskRabbit 15%, Uber 25-30%). Your 25% blended is mid-range — defensible because you're providing dispatch, tracking, payment processing, and customer acquisition. |
| LTV:CAC ratio (B2C) | **> 5:1** | Cross-industry healthy minimum is 3:1 (a16z). At $25 CAC and $200+ LTV, you're at 8:1 — which means you can afford to spend more on acquisition or your CAC estimate is too low. Pressure-test the $25 number. |
| LTV:CAC ratio (B2B) | **> 6:1** | At $500 CAC (sales effort) and $3,000+/year LTV, you're at 6:1. Solid, but watch the denominator — if enterprise sales (insurance partnerships) push CAC to $1,000+, the ratio compresses. |
| Chargeback rate | **< 0.5%** | Food delivery industry averages 0.80% (Chargeflow). Visa's VAMP threshold is 1.5%, dropping further in 2026. Trust Tier should drive this near 0% in Phase 1 since new customers can't use cards at all. The real test is Phase 2+ when Tier 2 customers start using cards. |
| Provider payout ratio | **70-75% of GMV** | Uber pays drivers 70-75% after fees. Your tiered model (70/75/80% by service category) is competitive. Don't let this creep below 70% — that's where provider churn accelerates. Stanford data shows pay dissatisfaction is the #1 churn driver. |

### Technical Success

**Performance (Non-Negotiable for Stranded Drivers)**

| Metric | Target | Evidence |
|---|---|---|
| Page load time (LCP, mobile 4G) | **< 2 seconds** | Every 1-second delay = 20% conversion drop (HubSpot). 53% bounce at 3+ seconds (Google). Average mobile load time is 8.6 seconds — most sites fail this. A stranded driver on I-285 at 11PM with 12% battery will not wait. |
| API response time (p95) | **< 340ms** | Industry best-practice p95 is ~340ms (Javarevisited latency benchmarks). Booking creation and dispatch endpoints must be here or faster. |
| Booking-to-dispatch cycle | **< 5 seconds** | Server-side job matching should complete in < 500ms (dispatch-specific benchmark). Add network latency and notification delivery = 5 seconds end-to-end is aggressive but achievable. |
| Concurrent booking capacity | **50 simultaneous** (Phase 1), **200** (Phase 4) | Phase 1 peak: ice storm scenario, everyone calls at once. 50 concurrent handles that. Phase 4 at 150 bookings/week = unlikely to exceed 10-15 concurrent even at peak. 200 gives 10x headroom. |

**Real-Time Infrastructure**

| Metric | Target | Evidence |
|---|---|---|
| WebSocket connection uptime | **> 99.9%** | Enterprise SLA benchmark is 99.999% (Ably). 99.9% allows ~43 min/month downtime — realistic for a self-hosted ws setup without managed infrastructure. |
| GPS update delivery latency | **< 500ms at p95** | Typical WebSocket p95 latency is ~340ms (DraftKings at scale). Add GPS serialization overhead. 500ms is the upper bound — customer sees provider position within half a second of movement. |
| Heartbeat / keepalive interval | **20 seconds** | HTTP proxies kill idle WebSocket connections after 30-120 seconds (websockets.readthedocs). 20-second ping keeps the connection alive through any proxy. |
| Reconnection on mobile network drop | **< 3 seconds** with exponential backoff | Mobile networks on I-285 are unreliable. Automatic reconnection with jitter prevents reconnection storms when cell towers switch. |

**Payment Integrity**

| Metric | Target | Evidence |
|---|---|---|
| Double-charge rate | **0%** | Stripe processes at 99.999% reliability (Stripe 2023). Out of 300M transactions, ~3,000 could fail. Idempotency keys on every payment operation are mandatory — not optional. |
| Webhook delivery reliability | **99.99%+** | Stripe retries failed webhooks for up to 3 days with exponential backoff (Stripe docs). Build a dead-letter queue for the remaining 0.01%. Zero lost payment confirmations. |
| Manual payment confirmation SLA | **< 4 hours** | Cash/CashApp/Zelle payments require admin confirmation. > 4 hours and providers start wondering if they'll get paid. > 24 hours and they churn. |
| Trust Tier bypass paths | **Zero** | If a Tier 1 customer can pay by card through any code path, the entire chargeback protection model fails. This needs automated test coverage, not manual verification. |

**Data Integrity & Security**

| Metric | Target | Evidence |
|---|---|---|
| Lost booking rate | **0%** | Every submitted booking must persist. Database-level constraints + application-level validation. |
| System uptime | **> 99.5%** | Allows ~3.6 hours/month planned maintenance. Honest target for Coolify-hosted Docker deployment. Don't overpromise. |
| RPO (Recovery Point Objective) | **< 1 hour** | Automated PostgreSQL backups. 1 hour of lost data in a disaster = at most ~2 bookings lost (at Phase 1 volume). Acceptable for the risk profile. |
| Audit log coverage | **100% of financial mutations** | Every payment confirmation, payout, trust tier change, refund, and admin override logged with timestamp, actor, and before/after state. This isn't optional — it's how you prove your numbers are real when a B2B partner asks for an invoice reconciliation. |

### Measurable Outcomes

| Outcome | Metric | Target | Why This Number | How Measured |
|---|---|---|---|---|
| Faster than AAA | Response time ITP | < 15 min | AAA averages 21-23 min metro. 15 min = 30% faster. Marketing writes itself. | Dispatch → provider "arrived" timestamps |
| Trust Tier prevents fraud | Chargeback rate | < 0.5% | Industry avg 0.80% (food delivery). Visa threshold 1.5%. Trust Tier should put you well below. | Stripe dispute dashboard |
| Trust Tier doesn't kill conversion | Tier 1 booking completion rate | > 80% | If cash/CashApp/Zelle-only kills > 20% of bookings, the restriction is too aggressive. Atlanta market is cash-comfortable — this should hold. | Booking funnel: started → completed |
| B2B covers fixed costs | B2B monthly recurring revenue | > $6K by Month 2 | 3 contracts × $2K avg = $6K. This is the "don't die" number. If you can't close 3 B2B contracts in Atlanta in 60 days, the B2B thesis is wrong. | Contract tracking + invoice records |
| Providers earn enough to stay | 90-day retention | > 70% | Uber's estimated 90-day retention is ~66%. You pay providers 5-10% more of each job. Better economics should = better retention. If not, something else is broken (dispatch quality, job volume, UX). | Provider active status tracking |
| Referrals compound | % new customers from referrals | > 25% by Month 4 | Organic/referral > 50% of new customers by Month 6 is the goal. 25% by Month 4 is the leading indicator. If referrals stall below 15%, the post-service text isn't compelling enough or the service isn't worth recommending. | Referral link attribution |
| Diagnostics has a market | Diagnostic bookings/month | > 10 by Month 3 | ~28K private-party car sales/month in Atlanta metro (Cox Automotive data, population-adjusted). 10 bookings = 0.04% penetration. If you can't hit that, the demand signal is weak. | Booking data, service category filter |
| Platform is reliable | Uptime | > 99.5% | 3.6 hours/month maintenance window. Honest target for Coolify-hosted Docker deployment. Don't overpromise. | Health check monitoring |
| Dispatch algorithm works | First-dispatch acceptance rate | > 75% | Every rejected dispatch = 3-5 min added to customer wait. Below 75% means the algorithm is matching wrong (too far, wrong service type, wrong time). | Dispatch → acceptance event logs |
| Admin isn't the bottleneck | Daily admin time | < 30 min | Beel's morning check. If platform operations take > 30 min/day at Phase 1 volume (5-10 bookings/week), the automation isn't working. At Phase 3 volume (40-75/week), this number must not grow linearly or you need to hire. | Self-reported |

## Product Scope

### MVP — Minimum Viable Product

**The line:** Ship what takes real money from real customers and pays real providers, with fraud protection and operational visibility. Everything else waits.

**Must Build (9 features):**

| # | Feature | Effort | Why MVP |
|---|---|---|---|
| 1 | Trust Tier Payment System | 1-2 days | Without this, card payments = chargebacks. Industry avg 0.80%. Visa threshold 1.5%. One bad month kills your merchant account. |
| 2 | Time-Block Pricing | 0.5 day | AAA charges the same at 2AM as 2PM. After-hours calls are higher-risk, harder-to-staff. +25-50% multiplier captures the value and incentivizes provider availability. |
| 3 | Tiered Commission by Service | 0.5 day | Towing costs real fuel and wear vs. a battery jump. Same 25% take rate is unfair. Tiered commission (20/25/30%) keeps heavy-service providers from leaving. |
| 4 | Payment Flow Hardening | 1-2 days | Confirmation workflow, batch payouts, receipts, refunds. Without this, Beel is manually tracking payments in a spreadsheet. That breaks at 15 bookings/week. |
| 5 | Financial Reporting | 1 day | Revenue by source, service, payment method, time-block. Without this, you can't answer "is the business working?" with data. |
| 6 | Booking Flow: Now + Scheduled | 1 day | Single booking component with mode toggle — `immediate` or `scheduled`. Covers both emergency and diagnostic use cases. |
| 7 | Post-Service Referral Text | 0.5 day | Automated SMS with referral link after completion. Organic/referral needs to reach 50% of new customers by Month 6 to control CAC. |
| 8 | Vehicle Observation Checklist | 0.5 day | Provider notes "brake pads worn" during jump start → customer gets follow-up → upsell pipeline into diagnostics. Bridges Front Door 1 to Front Door 2. |
| 9 | Branded Inspection Report (PDF) | 1-2 days | Auto-generated post-inspection report emailed to customer. Without the report, you're just a mobile mechanic from Craigslist. The report IS the product. |

**Total estimated effort: ~7-9 dev days for 9 new features.** Existing platform covers booking flow, auto-dispatch, GPS tracking, provider portal, admin dashboard, multi-payment, notifications, reviews, SEO, auth, and deployment.

**Already Built — Verify & Harden:**
12 existing platform features confirmed functional under production load. Key verification: WebSocket stability under concurrent connections, Stripe webhook resilience, Coolify deployment health checks.

### Growth & Vision Phases

Detailed phase-by-phase feature tables, dependency chains, and risk mitigations are in the **Project Scoping & Phased Development** section. Summary:

- **Phase 2 (Month 2-4):** Subscription billing, B2B invoicing, Storm Mode, provider volume bonuses, referral credits, seller-side certificates
- **Phase 3 (Month 4-8):** OTP zone expansion, provider territories, leaderboard/gamification, Roadside Warranty, weather API auto-activation
- **Phase 4 (Month 8-12):** Insurance dispatch API, claims-based pricing, fleet portal, mobile app, provider training
- **Year 2+:** Southeast expansion, vehicle health data marketplace, AI predictive dispatch, franchise model

## User Journeys

### Journey 1: Keisha — The Stranded Commuter (B2C Emergency, Happy Path)

**Opening Scene:**
It's 7:14 PM on a Wednesday. Keisha's sitting in her 2017 Honda Civic in the Buckhead office parking deck, Level 3. She turns the key — nothing. Dead battery. The deck lights are that yellowy fluorescent. She's alone. Her coworkers left an hour ago. Phone's at 34%.

She Googles "jump start near me Atlanta." First result is AAA — she's not a member. Second result is her insurance company — she'd need the policy number from the glove box app she's never set up. Third result is a tow company with 2.8 stars and "CASH ONLY" in all caps.

**Rising Action:**
Fourth result: RoadSide ATL. She taps through. No login wall. No membership gate. She sees "Jump Start" as a service tile, taps it. Her phone's GPS auto-fills the location — "Buckhead Office Park, Level 3." She confirms.

Screen shows: "Standard rate: $65. CashApp, Zelle, or Cash accepted." She picks CashApp. She doesn't think about why there's no credit card option — CashApp is what she uses for everything anyway.

She taps "Request Service." The screen shifts to a live map. A blue dot labeled "Marcus T. — 1.2 miles away" starts moving toward her. ETA: 8 minutes. She can see him turn onto Peachtree Road. She exhales.

**Climax:**
Marcus pulls up in a truck with RoadSide ATL magnets on the doors. He's already got the portable jump starter in hand. Doesn't ask her to pop the hood — he knows where it is on a Civic. Battery's jumped in 4 minutes. He tells her: "Your battery's original — 8 years on a Honda battery is borrowed time. Might want to get that swapped this weekend."

She pays via CashApp — notification pops on both phones. Done.

**Resolution:**
5 minutes later, she gets a text: "Thanks for using RoadSide ATL! Share $15 off with a friend:" with a referral link. She screenshots it and drops it in her building's group chat: "Just got rescued in the parking deck in 12 minutes. No membership, no BS."

Two days later, she gets a push notification: "Based on Marcus's observation, your battery may need replacement. Book a diagnostic check — $250, we come to you." She saves it for the weekend.

**Requirements Revealed:**
- Guest booking flow (no account required for first service)
- GPS auto-fill for location
- Trust Tier payment method enforcement (CashApp/Zelle/Cash only for new customers)
- Real-time provider tracking with live map, name, distance, ETA
- Provider vehicle observation notes (post-service)
- Automated post-service referral SMS with unique link
- Follow-up notification pipeline (observation → diagnostic upsell)
- Provider profile display (name, photo, rating)

---

### Journey 2: Darius — The Used Car Buyer (B2C Diagnostics, Happy Path)

**Opening Scene:**
Darius found a 2014 Nissan Altima on Facebook Marketplace. $5,200. Seller's in Decatur, 20 minutes away. Photos look clean. Seller says "runs great, no issues." Darius has $5,400 saved — this is his whole car budget.

His uncle knows cars but works weekends and lives in Marietta. His boy Terrence says "just drive it around the block, you'll know." Darius knows he won't know.

He sees a RoadSide ATL ad in the Marketplace sidebar: "Don't buy blind. Pre-purchase inspection — $250, we come to the car."

**Rising Action:**
He taps through to the booking page. Selects "Pre-Purchase Inspection." Three tiers:
- Basic ($250): Full mechanical inspection + OBD2 diagnostics + branded PDF report
- Standard ($325): Everything in Basic + tow-if-fails (if the car doesn't pass, free tow to a shop)
- Premium ($400): Everything in Standard + 72-hour money-back guarantee

He picks Basic — $250 is already a stretch. Enters the seller's address and picks Saturday at 2PM. The seller agreed to let an inspector come.

Pays with Zelle at checkout. Gets a confirmation text with the appointment details and the inspector's name: "Tony M. will arrive at 1:45 PM."

**Climax:**
Saturday. Tony shows up 15 minutes early, introduces himself to both Darius and the seller. Plugs in the OBD2 scanner. Checks under the hood, underneath the car, brakes, tires, fluids. Runs it through the gears.

20 minutes later, Tony pulls Darius aside. "Transmission's showing early signs of failure — the fluid is dark and there's a shudder between 2nd and 3rd. OBD2 is showing a pending P0700 code that was cleared recently. This car needs a $2,500 transmission job within 6 months."

**Resolution:**
Darius thanks Tony. Walks away from the deal. Within 90 minutes, he gets an email with a branded PDF: "RoadSide ATL Pre-Purchase Inspection Report" — 4 pages with photos, OBD2 codes, fluid conditions, tire tread measurements, and a pass/fail summary. The car failed.

Darius shares the report in his group chat. His friend Keyana, who's also car shopping, books her own inspection the next week using his referral link. Both get $15 credit.

**Requirements Revealed:**
- Scheduled booking with date/time picker and location input
- Tiered diagnostic products with clear feature comparison
- Pre-service confirmation SMS with inspector name and arrival time
- OBD2 diagnostic integration (scanner data capture)
- Branded PDF report generation (auto-generated, emailed post-service)
- Inspection report content: photos, codes, measurements, pass/fail summary
- Referral link sharing from report email
- Service category: diagnostics (distinct from emergency)

---

### Journey 3: Andre — The Rideshare Flywheel (Customer → Provider → Subscriber → Recruiter)

**Opening Scene:**
Andre drives Uber full-time out of a 2019 Toyota Camry. 45-50 hours a week. It's 2:17 AM at Hartsfield-Jackson airport, rideshare staging lot. He just dropped off his last ride and is waiting in the queue. His right rear tire is soft — he can feel the pull. He checks: yep, nail in the sidewall.

If he calls AAA, it's a 45-minute wait. Every minute he's off-road is $1.50 in lost fares. He needs this fixed NOW.

**Rising Action — As Customer:**
He Googles "flat tire change near me." Finds RoadSide ATL. Books "Flat Tire Change" — location auto-fills to the airport staging lot. $75, pays with CashApp. Provider arrives in 11 minutes — another rideshare driver named Jaylen who does RoadSide ATL jobs during dead hours. Spare tire on in 15 minutes. Andre's back in the Uber queue by 2:45 AM.

**Rising Action — As Provider:**
The next day, Andre gets a follow-up text: "Got rescued in 11 minutes. Want to be the rescuer? RoadSide ATL providers earn $50-100/shift during slow ride hours. Starter Kit: $299."

He clicks through. Watches the 3-minute demo video. Sees the math: jump starts pay $65, provider keeps $45.50 (70%). Lockouts pay $55, provider keeps $38.50. Fuel deliveries pay $60, keeps $42. During Uber dead hours (2-5 PM, 1-4 AM), he could clear 2-3 jobs.

He buys the Provider Starter Kit: portable jump starter, slim jim set, 2-gallon fuel can, safety vest, RoadSide ATL door magnets. $299.

**Climax:**
First week as a provider. Tuesday at 3 PM — dead Uber hours. Gets a job notification: "Jump Start — 0.8 miles away — $65." Accepts. Arrives in 6 minutes. Battery jumped in 5 minutes. Customer pays with Zelle. $45.50 in his pocket for 15 minutes of work.

By the end of the week, he's done 7 RoadSide ATL jobs during Uber dead time. $310 extra. His best Uber-only week was $1,100. This week: $1,410 combined.

**Resolution:**
He subscribes to the Rideshare Priority Plan ($39/month) — guaranteed sub-20-min response when HE needs help, plus one free basic service per month. He recruits his roommate and another driver from the airport staging lot. Gets $200 in provider referral bonuses when they each complete 5 jobs.

One person: customer ($75 first service) + provider ($310/week commissions) + subscriber ($39/month) + recruiter ($400 in referral bonuses) = $1,679 annual value from a single user.

**Requirements Revealed:**
- Provider recruitment funnel triggered by customer service completion
- Provider Starter Kit purchase flow
- Provider onboarding: application → approval → first job available (< 48 hours)
- Provider job notification system (push notification with distance, service type, payout amount)
- Job acceptance/rejection workflow
- Provider earnings dashboard (daily/weekly/monthly breakdown)
- Provider-to-customer subscription conversion prompt
- Provider-refers-provider referral tracking ($100-200 bonus after 5 completed jobs)
- Dual-role user support (same account can be customer AND provider)
- Commission transparency on job acceptance screen

---

### Journey 4: Derek — The Dealership Manager (B2B Account, Happy Path)

**Opening Scene:**
Derek manages three used car lots in Decatur. Moves 30-50 cars a month. No in-house mechanic — can't justify the salary at his volume. His current solution for inspections, lot transfers, and customer breakdowns is "calling his guy" — a tow operator named Ray who answers his phone maybe 60% of the time.

This morning: 8 cars arrived from auction. 3 need to move from Lot B to Lot A. All 8 need inspections before listing. And his sales manager just texted — a customer who bought a Camry last Tuesday is stranded with a dead battery on Moreland Ave and is "very upset."

Derek calls Ray. Voicemail.

**Rising Action:**
A RoadSide ATL rep walks onto Lot A at 10 AM with a one-pager. "We handle inspections, lot transfers, and buyer coverage. One platform, one invoice, one monthly bill. We guarantee sub-15-minute response for your customers."

Derek's skeptical but takes the pilot offer: 3 free inspections. The rep books them from the lot using Derek's new B2B account. Within 2 hours, two inspectors have covered all 3 cars. Derek gets PDF reports emailed to his business address — branded, professional, with photos and OBD2 data. One car has a catalytic converter issue he wouldn't have caught until a customer complained.

**Climax:**
Derek signs the Dealer Partner Agreement:
- Bulk inspections: $200/each (vs. $250 retail) — he needs 8-10/month
- Lot transfers: $90/each (vs. $125 retail) — 3-5/month
- Buyer coverage: $50/enrollment, 6-month free coverage for his customers — funded by the dealer, managed by RoadSide ATL
- Priority dispatch for his customers' breakdowns
- One monthly invoice, Net 30

The stranded Camry customer? Derek dispatches through his B2B portal. Provider arrives in 12 minutes. Customer calls back: "Thank you — that was incredible. I'll buy from y'all again."

**Resolution:**
Month 1 invoice: $2,850 (10 inspections + 4 transfers + 8 buyer enrollments + 3 ad-hoc services). Derek's spending less than he was on Ray — and the service actually shows up. He refers his dealer friend in Stone Mountain. Second lot signs within a week.

Every customer enrolled in buyer coverage becomes a personal RoadSide ATL customer after the 6-month coverage expires. Zero acquisition cost.

**Requirements Revealed:**
- B2B account type with business profile (company name, billing address, contact)
- B2B contract management (retainer, per-job rates, included services, terms)
- B2B booking portal (submit multiple requests, view status)
- Priority dispatch flag for contract accounts
- Bulk booking capability (multiple inspections in one request)
- Monthly invoice auto-generation (itemized by service, emailed as PDF)
- Invoice status tracking (draft → sent → paid → overdue)
- B2B dashboard in admin panel (accounts, contracts, invoices, outstanding balance)
- Buyer coverage enrollment (dealer-funded, time-limited)
- B2B-tagged bookings for consolidated billing

---

### Journey 5: Marcus — The Independent Tow Operator (Provider, Happy Path)

**Opening Scene:**
Marcus owns his own tow truck. 8 years experience. Works south Atlanta — College Park, East Point, Hapeville. His income sources: police rotation list (unpredictable, 2-3 calls/week), word-of-mouth (inconsistent), and a loose relationship with an auto shop that calls him for tows (maybe 5/month).

He makes $3,200/month on a good month. His truck payment is $1,200. Insurance is $400. Fuel is $600. On a bad month, he's underwater.

It's 2 PM on a Thursday. He's parked at a QT on Old National Highway, scrolling his phone. No jobs. No calls. This is the third 3-hour dead gap this week.

**Rising Action:**
He sees a Facebook ad in a tow truck driver group: "RoadSide ATL — Free leads for Atlanta tow operators. No sign-up fee. Keep 75-80% of every job."

He clicks through. Application takes 8 minutes: name, truck info, insurance verification upload, service area, available hours. He submits.

Next morning, 9 AM: approval email. Downloads the provider app. Sets his availability to "Online." His service area: College Park, East Point, Hapeville, airport corridor.

11:23 AM: first notification. "Towing — Flat tire, needs tow to Firestone — 1.4 miles away — $125 — Provider payout: $93.75 (75%)." He accepts. Arrives in 9 minutes. Car loaded, dropped at Firestone in 20 minutes total. Customer pays with CashApp. He sees $93.75 credited in his provider dashboard.

**Climax:**
End of first month: 22 platform jobs completed. $1,650 in provider earnings — ON TOP of his existing rotation and word-of-mouth work. Total month: $4,850. Best month in two years.

His provider dashboard shows: "22/20 jobs — Volume Bonus Tier 1 reached! Next month: 5% reduced platform take." His rating: 4.8/5. He earns "Preferred Provider" badge — first dibs on high-value jobs in his zone.

**Resolution:**
Marcus recruits another tow operator he knows — Darnell, who works the I-75 South corridor. When Darnell completes his 5th job, Marcus gets a $150 referral bonus. Marcus's idle time drops from 15 hours/week to 5. He's thinking about a second truck.

**Requirements Revealed:**
- Provider application flow (8-minute target: name, vehicle info, insurance upload, service area, hours)
- Provider approval workflow (admin reviews, approves/denies within 48 hours)
- Provider availability toggle (online/offline)
- Service area configuration (zone-based)
- Job notification with: service type, distance, price, provider payout amount
- Job accept/decline with timeout (auto-decline after X seconds, dispatch to next)
- Provider earnings dashboard (per-job breakdown, daily/weekly/monthly totals)
- Volume bonus tracking (progress bar to next tier)
- Provider rating system with badge levels
- Provider-refers-provider tracking and bonus payout

---

### Journey 6: Beel — The Platform Operator (Admin, Daily Operations)

**Opening Scene:**
7:15 AM. Coffee. MacBook. Beel opens the admin dashboard. This is the 15-minute morning check that runs the business.

**The Morning Check:**

**Payments Queue (2 minutes):**
Dashboard shows 4 payments pending confirmation from last night. Three CashApp payments — he cross-references his CashApp business account, sees the matching amounts and booking IDs. Confirms all three with one click each. One cash payment — provider Marcus confirmed receipt in-app. Beel marks it confirmed.

One payment has been pending 6 hours — a Zelle payment from 1 AM that he can't match. He flags it for follow-up and sends the customer an automated "payment not received" text.

**Provider Payouts (3 minutes):**
8 provider payouts ready for processing from the previous batch window. Beel reviews the list: amounts match expected commissions (he spot-checks one — $125 tow job × 75% = $93.75, correct). Selects all 8, clicks "Process Batch Payout." Audit log entry created. Providers get notification: "Payout processed — $93.75 deposited."

**Revenue Check (2 minutes):**
Weekly revenue widget: $3,400 this week (up from $2,900 last week). Breakdown: 60% B2B contract work, 25% B2C emergency, 15% diagnostics. Time-block premium captured: $340 (4 after-hours jobs at +25%). Subscription MRR: $224.85 (15 RoadSide Pass subscribers).

**Provider Status (2 minutes):**
3 providers currently online. 2 new applications pending (submitted yesterday). Beel opens both: one is a tow operator with valid insurance — approves. One is a rideshare driver with an expired driver's license photo — sends back for re-upload.

**Bookings Overview (2 minutes):**
Yesterday: 6 completed bookings, 0 cancellations, average response time 14 minutes. One 4-star review with comment: "Provider was great, app was a little slow loading the map." Beel notes the performance issue — checks the system health page. WebSocket connections stable, but page load spiked to 3.2s during a brief Coolify restart at 11 PM. Resolved.

**Edge Case — Storm Mode (when needed):**
Weather.com shows ice storm hitting Atlanta Friday night. Beel activates Storm Mode: selects "Ice Storm" template (+75% surge), sets start time 6 PM Friday, end time 12 PM Saturday. All active providers get a push notification: "Peak pay activated Friday night — 75% surge on all jobs." Customer-facing: "High demand pricing active — response times may be longer."

**Requirements Revealed:**
- Admin dashboard with morning check layout (payments → payouts → revenue → providers → bookings)
- Manual payment confirmation workflow (CashApp/Zelle/Cash matching)
- Batch payout processing (select multiple → process → audit log)
- Revenue analytics widget (weekly trend, breakdown by source/channel/time-block)
- Subscription MRR tracking
- Provider application review queue (approve/deny/request re-upload)
- Provider online/offline status monitoring
- Booking analytics (completed, cancelled, avg response time, ratings)
- Storm Mode activation (template selection, start/end time, provider notification, customer pricing display)
- System health monitoring (WebSocket status, page load times)
- Audit log for all financial actions

---

### Journey 7: Keisha Returns — Edge Case: Failed Dispatch + Trust Tier Progression

**Opening Scene:**
Three months after her first rescue, Keisha's car overheats on I-285 South near the Ashford Dunwoody exit. 5:45 PM. Rush hour. She opens RoadSide ATL — this time she has an account.

**Rising Action:**
She books "Overheat / Coolant" service. Price shows: $85 (After-Hours rate kicks in at 6 PM — she booked at 5:45 PM, so standard rate applies). She confirms.

Auto-dispatch fires. Nearest provider, Jaylen, is 1.8 miles away. Jaylen gets the notification but he's in the middle of an Uber ride — declines. Second dispatch: Marcus, 3.4 miles away. Marcus accepts. ETA: 14 minutes.

But Marcus hits traffic on I-285 (because of course he does). ETA updates in real-time: 14 → 18 → 22 minutes. Keisha sees the dot crawling. She gets an automated text at the 20-minute mark: "Your provider is in heavy traffic. Updated ETA: 22 minutes. We apologize for the delay."

**Climax:**
Marcus arrives at 22 minutes. Checks the coolant — it's bone dry. Adds coolant, checks for obvious leaks (none visible), and advises: "This is a temporary fix. You need to get this checked at a shop this week — could be a thermostat or a head gasket."

Keisha pays with CashApp. She's completed 6 services with RoadSide ATL now. Post-service notification: "Congratulations! You've unlocked credit card payments. You can now pay with any method."

**Resolution:**
She rates the experience 4 stars — "took a bit longer than usual but Marcus was great." She books a diagnostic appointment for Saturday to get the cooling system checked. This time, she pays with her Visa — Trust Tier 2 unlocked.

**Requirements Revealed:**
- Multi-provider dispatch cascade (first provider declines → auto-dispatch to second)
- Real-time ETA updates when provider is delayed
- Automated delay notification at configurable threshold (e.g., 20 minutes)
- Trust Tier progression notification ("You've unlocked card payments!")
- Trust Tier status persistence across sessions
- Time-block pricing boundary handling (booking time vs. service time)
- Provider in-app decline with reason (optional)
- Rating system with comment field
- Cross-service booking (emergency → diagnostic follow-up)

---

### Journey 8: Tanya — Apartment Property Manager (B2B, Resident Rescue)

**Opening Scene:**
Sunday morning, 8:30 AM. Tanya's phone buzzes. Resident in Unit 312: "My car won't start in the parking deck. I have a flight at noon. PLEASE HELP."

Before RoadSide ATL, Tanya's response was: "Sorry, we don't offer that service. You might try AAA." Which earned her building a 1-star Google review last month: "Management doesn't care about residents. Locked out of my car for 3 hours in their parking deck."

**Rising Action:**
Tanya opens the RoadSide ATL B2B portal on her phone. Hits "Request Service for Resident." Selects "Jump Start." Enters: "Parking Deck, Level 2, near elevator B." Selects "Bill to property account."

Resident gets a text: "RoadSide ATL is on the way — your building has you covered. ETA: 9 minutes."

**Climax:**
Provider arrives at the parking deck. Jump starts the car. Resident makes her flight. She posts in the building's Facebook group: "Shoutout to management — locked out of my car and they sent someone in 10 minutes FOR FREE. This building is incredible."

**Resolution:**
Resident downloads RoadSide ATL for personal use. When her coverage through the building doesn't apply (she's stranded on Ponce de Leon, not in the parking deck), she books as a regular customer. She's been acquired at $0 CAC.

Monthly invoice to Tanya's property management company: $250 flat rate, 7 services rendered (5 jump starts, 2 lockouts). Cost per rescue: $35.71. Cheaper than one bad Google review.

**Requirements Revealed:**
- B2B resident service request flow (property manager dispatches on behalf of resident)
- Resident notification (text to resident with ETA — even though they didn't book)
- "Bill to property account" option in booking flow
- B2B monthly invoice itemization (services rendered, per-service cost)
- Resident → personal customer conversion tracking
- B2B usage analytics (services/month, types, average response time)

---

### Journey 9: Payment Dispute — Support/Troubleshooting Path

**Opening Scene:**
Customer books a tow. Provider arrives, loads the car, delivers it to the shop. Total: $150. Customer paid with CashApp. Provider confirms service complete.

Three hours later, the customer contacts RoadSide ATL: "The driver scratched my bumper loading it onto the truck. I want a refund."

**Rising Action:**
Beel sees the support message in the admin dashboard. Opens the booking record: completed, paid, provider Marcus, rating not yet submitted.

He checks the provider's job notes: "Vehicle loaded without issue. Minor pre-existing scratch noted on rear bumper — photo attached." Marcus uploaded a pre-service photo showing the scratch already there.

**Climax:**
Beel responds to the customer with the timestamped photo. Customer backs down. No refund needed. Beel adds an internal note to the booking: "Dispute resolved — pre-existing damage documented by provider."

If the customer HAD been right: Beel initiates a partial refund ($50) through the admin panel. The refund workflow: creates refund record → adjusts provider payout (provider still gets full pay — platform absorbs the cost, it was the provider's fault) → updates payment status → sends customer receipt → audit log entry.

**Resolution:**
Beel makes a note: require pre-service photo documentation for all towing jobs going forward. Adds it to the provider checklist. This becomes a platform-wide policy.

**Requirements Revealed:**
- Support/dispute queue in admin dashboard
- Booking record detail view (timeline, payment, provider notes, photos)
- Provider pre-service photo upload capability
- Admin refund workflow (partial/full, with adjustment to provider payout or platform absorption)
- Refund receipt auto-generation
- Internal notes on bookings (admin-only, not customer-visible)
- Audit log for all dispute resolutions
- Provider checklist configuration (admin can add required steps)

---

### Journey 10: Lisa — Insurance Dispatch Partnership (B2B Enterprise, API Integration)

**Opening Scene:**
Lisa coordinates roadside claims for a mid-size auto insurance company covering Georgia. Her current provider: a national dispatch network (Agero-powered) that sends tow trucks from 30 miles away to Atlanta addresses. Average response time: 58 minutes. Customer NPS for roadside claims in Atlanta: 22.

Her boss wants Atlanta NPS above 40 by Q3.

**Rising Action:**
RoadSide ATL proposes a pilot: handle all Atlanta metro roadside claims for one zip code (30312 — East Atlanta/Grant Park). Guaranteed sub-20-minute response. Per-job pricing negotiated at $15 below retail. Guaranteed payment — no disputes, no chargebacks, net 15 terms.

Lisa routes 30312 claims to RoadSide ATL for 30 days. Her team monitors response times, completion rates, and customer feedback.

**Climax:**
Pilot results after 30 days:
- 47 claims handled
- Average response time: 13 minutes (vs. 58-minute national average)
- Completion rate: 98% (one cancelled by customer)
- Customer satisfaction: 4.7/5
- NPS for 30312: 61 (vs. 22 pre-pilot)

Lisa's boss signs the expansion: all Atlanta metro zip codes, estimated 200-300 claims/month. Contract value: $8,000-12,000/month.

**Resolution:**
Phase 4 feature: API integration so Lisa's claims system auto-dispatches to RoadSide ATL for Atlanta metro claims. No manual routing needed. Real-time status updates flow back to Lisa's dashboard via webhook.

**Requirements Revealed (Phase 4 — Vision):**
- API endpoint for external dispatch requests
- Webhook callbacks for status updates (dispatched, en route, arrived, completed)
- Enterprise contract management (volume-based pricing, guaranteed SLAs)
- White-label or co-branded service delivery
- Enterprise reporting (response times, completion rates, NPS impact)
- API authentication and rate limiting for partner integrations

---

### Journey Requirements Summary

| Journey | User Type | Key Capabilities Revealed |
|---|---|---|
| Keisha (Emergency) | B2C Customer | Guest booking, GPS auto-fill, live tracking, Trust Tier enforcement, referral SMS, observation → diagnostic upsell pipeline |
| Darius (Diagnostics) | B2C Customer | Scheduled booking, tiered products, PDF report generation, OBD2 data capture, pre-service confirmation SMS |
| Andre (Flywheel) | Customer → Provider | Dual-role accounts, provider recruitment funnel, starter kit purchase, job notifications, earnings dashboard, subscription conversion, provider referrals |
| Derek (Dealership) | B2B Account | B2B portal, bulk booking, priority dispatch, monthly auto-invoicing, buyer coverage enrollment, contract management |
| Marcus (Tow Operator) | Provider | Application flow, approval workflow, availability toggle, job accept/decline, earnings tracking, volume bonus progress, rating badges |
| Beel (Admin) | Platform Operator | Morning check dashboard, payment confirmation, batch payouts, revenue analytics, provider approval queue, Storm Mode activation, system health |
| Keisha Returns (Edge Case) | B2C Repeat Customer | Dispatch cascade (multi-provider), real-time ETA updates, delay notifications, Trust Tier progression, cross-service booking |
| Tanya (Apartment) | B2B Account | Resident dispatch on behalf, resident notification, bill-to-account, usage analytics, resident → personal customer conversion |
| Payment Dispute | Support/Troubleshooting | Dispute queue, pre-service photos, refund workflow, internal notes, audit log, provider checklist configuration |
| Lisa (Insurance) | B2B Enterprise (Vision) | External API dispatch, webhook status callbacks, enterprise SLAs, white-label delivery, partner reporting |

**Coverage Check:**
- Primary user happy path: Keisha, Darius
- Primary user edge case: Keisha Returns (failed dispatch, Trust Tier progression)
- Secondary user (provider): Marcus, Andre (both heavy and light service)
- B2B accounts: Derek (dealership), Tanya (apartment), Lisa (insurance/enterprise)
- Admin/operations: Beel (daily operations, Storm Mode)
- Support/troubleshooting: Payment dispute resolution
- API/integration: Lisa (Phase 4 vision)

All 11 product brief personas covered. 10 narrative journeys. Every interaction with the system has a story.

## Domain-Specific Requirements

### Compliance & Regulatory

**Payment Processing (PCI-DSS Adjacent)**
- Stripe handles PCI-DSS compliance for card transactions — platform never touches raw card numbers
- CashApp/Zelle/Cash payments are peer-to-peer and outside PCI scope, BUT the platform records transaction metadata (amounts, timestamps, booking IDs) — this data must be handled with standard data protection practices
- **Money transmission risk:** Marketplace collects payment from customer and distributes to provider. In most states, this triggers money transmitter licensing requirements UNLESS the platform uses a licensed payment processor (Stripe Connect) that handles the funds flow. Stripe Connect's "destination charges" model keeps RoadSide ATL out of money transmitter territory — verify this architecture is in place
- **Georgia stored-value regulations:** Pre-Paid Credit System (Phase 2) requires review of Georgia's Uniform Money Services Act (O.C.G.A. § 7-1-680). Stored-value products over $5 may require licensure. This is correctly deferred in the product brief

**Independent Contractor Classification (Critical)**
- Providers are independent contractors, not employees. The IRS 20-factor test and Georgia's common law test both apply
- Platform must NOT: set provider schedules, require exclusivity, dictate service methods, provide equipment (the starter kit is a purchase, not a provision), or control pricing (providers accept or decline jobs at stated rates)
- Platform CAN: set quality standards, require insurance, use rating systems, offer volume bonuses
- **1099 reporting:** Providers earning $600+/year require 1099-NEC filing. Financial reporting must support annual 1099 generation with provider SSN/EIN collection during onboarding
- **Risk:** Misclassification lawsuits are the #1 existential legal risk for gig platforms. Uber, Lyft, DoorDash, and Instacart have collectively spent billions defending classification. RoadSide ATL's model (providers own equipment, set availability, accept/decline jobs freely) is defensible but must be maintained carefully as the platform scales

**Consumer Protection (Georgia-Specific)**
- Georgia Fair Business Practices Act (O.C.G.A. § 10-1-390) prohibits deceptive trade practices — all pricing must be transparent and accurate at booking time
- Time-block pricing, surge pricing, and service tier pricing must be clearly displayed before customer confirms booking
- Refund policy must be stated and accessible
- After-hours/emergency pricing multipliers must be disclosed, not hidden

**Insurance & Liability**
- Providers must carry their own commercial auto insurance and general liability — verified during onboarding
- Platform should carry general liability insurance covering marketplace operations (not service delivery)
- Terms of Service must clearly establish providers as independent contractors and limit platform liability to marketplace facilitation
- Pre-service photo documentation (from Journey 9) provides liability protection for damage disputes

### Technical Constraints

**Real-Time Safety Requirements**
- GPS tracking accuracy: must use device GPS, not IP geolocation. Cell tower triangulation on I-285 can be off by 500+ meters — useless for a stranded driver
- Provider identity verification: photo + name displayed to customer before arrival. Customer must know who's coming to them in an isolated, vulnerable situation
- Session timeout handling: if WebSocket drops during active tracking, the booking state must persist server-side. Customer reconnecting must see current provider location, not a stale state
- Emergency fallback: if auto-dispatch fails to find a provider within configurable timeout (e.g., 10 minutes), surface options — expand search radius, notify admin, or offer to call 911/non-emergency dispatch

**Location Data Privacy**
- Real-time GPS data of providers is sensitive — providers' location should only be visible to the customer during active booking, not stored indefinitely
- Customer location data retained only for booking record and dispute resolution
- No selling or sharing location data with third parties
- GPS tracking ends when provider marks job complete — no background tracking

**Payment Data Handling**
- Stripe tokens only — no raw card numbers stored in the database, ever
- CashApp/Zelle transaction IDs logged for reconciliation but no bank account details stored
- Cash payments tracked by amount and admin confirmation timestamp only
- Payment audit trail immutable — no soft deletes on financial records

**Availability & Disaster Recovery**
- This is not life-safety software — a platform outage means customers Google a tow company, not that someone dies. 99.5% uptime is honest and appropriate
- BUT: during active bookings, a crash is unacceptable. Active booking state must survive application restarts (persisted to database, not in-memory only)
- PostgreSQL automated backups every hour (Coolify supports scheduled pg_dump)
- No multi-region — single Coolify deployment is appropriate for Atlanta-only Phase 1-3

### Integration Requirements

**Current Integrations (Built)**

| System | Purpose | Status |
|---|---|---|
| Stripe | Card payments, subscription billing | Built — needs Trust Tier enforcement layer |
| Twilio | SMS notifications (booking confirmations, referral texts, provider alerts) | Built |
| Resend | Email notifications (receipts, reports, invoices) | Built |
| Google Maps API | Location services, distance calculations, ETA | Built |
| WebSocket (ws) | Real-time GPS tracking | Built |
| NextAuth v5 | Authentication (Google OAuth, credentials, email verification) | Built |

**Phase 2+ Integrations (Planned)**

| System | Purpose | Phase |
|---|---|---|
| Stripe Connect | Provider payouts via platform (replacing manual payouts) | Phase 2 |
| Weather API | Storm Mode auto-activation triggers | Phase 3 |
| OBD2 scanner data import | Diagnostic report data capture | Phase 2 |
| PDF generation library | Branded inspection reports, B2B invoices | MVP |

**Integration Constraints:**
- Google Maps API costs scale with usage — at 150 bookings/week (Phase 4), estimate 600-900 API calls/week (booking geocode + dispatch distance matrix + tracking route). At $5/1000 calls, this is ~$15-20/month — negligible
- Twilio SMS costs: ~$0.0079/segment. At 150 bookings/week with 3-4 texts per booking = ~$15-20/month
- Stripe fees: 2.9% + $0.30 per card transaction. At Phase 4 volume, ~$500-800/month in processing fees. This comes out of the platform's take rate, not additional cost

### Risk Mitigations

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **Provider misclassification lawsuit** | Critical | Medium | Maintain contractor independence: no schedules, no exclusivity, provider-owned equipment, accept/decline freedom. Document in TOS. Legal review before scaling past 50 providers. |
| **Chargeback cascade** | High | Low (with Trust Tier) | Trust Tier prevents card access for new customers. Monitor card chargeback rate weekly once Tier 2 unlocks. Visa VAMP threshold is 1.5% — automated alert at 0.5%. |
| **Provider causes injury/damage during service** | High | Low | Require provider insurance verification at onboarding with annual re-verification. Pre-service photo documentation for towing. Platform TOS limits liability to marketplace facilitation. |
| **Provider no-show on emergency call** | Medium | Medium | Multi-provider dispatch cascade. Provider no-show rate tracked — deactivation at > 10%. Customer receives automated notification if provider cancels with re-dispatch in < 2 minutes. |
| **Data breach (customer/provider PII)** | High | Low | Stripe handles payment data. Encrypt PII at rest (provider SSN for 1099). Minimal data collection principle. No location data retention beyond booking lifecycle. |
| **Surge pricing backlash** | Medium | Medium | Transparent pricing displayed before booking confirmation. Cap surge multiplier at 2x. Storm Mode clearly labeled. Consider competitor benchmarking — Uber faced significant backlash for 8-10x surge. |
| **Platform outage during active bookings** | Medium | Low | Active booking state persisted to database (not in-memory). Application restart recovers all in-progress bookings. Health check monitoring with admin alerting. |
| **Money transmitter classification** | Critical | Low | Use Stripe Connect destination charges model where Stripe handles the funds flow. Do NOT hold customer funds in a platform bank account. Legal review before implementing Pre-Paid Credits (Phase 2). |
| **Georgia regulatory action** | Medium | Low | Roadside assistance is not a regulated service category in Georgia (unlike towing in some states). Monitor: GA Public Service Commission rulings and any new gig economy legislation. |

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Trust Tier Payment System — Proprietary Chargeback Elimination**

No marketplace has solved chargebacks this way. The standard approach: eat the fraud, build dispute teams, and hope Stripe doesn't shut you down. Uber loses hundreds of millions annually to fraud and chargebacks. DoorDash built an entire trust & safety division.

RoadSide ATL's approach is structurally different: new customers simply cannot use reversible payment methods. Cash, CashApp, Zelle — all non-reversible. Card access is earned after a configurable number of clean completions. This doesn't reduce chargebacks — it eliminates them at the source for the highest-risk segment (first-time users with no platform history).

**Why it works for this market specifically:** Atlanta's cash/CashApp culture makes this restriction invisible. Keisha in the product brief doesn't think about why there's no credit card option — CashApp is what she uses for everything. In San Francisco or New York, this would kill conversion. In Atlanta, it's a feature.

**Innovation type:** Novel business model mechanic applied to marketplace payment infrastructure.

**2. Two Front Doors, One Platform — Blue Ocean Category Creation**

No single player combines emergency roadside dispatch AND pre-purchase vehicle diagnostics. Roadside companies (AAA, Agero, HONK) don't do diagnostics. Diagnostic shops and mobile mechanics don't build real-time dispatch marketplaces. These are treated as entirely separate industries.

RoadSide ATL's insight: both categories serve the same human anxiety — "Can I trust my car?" The stranded driver and the used car buyer are experiencing different versions of the same fear. One platform, one trust relationship, two entry points.

The vehicle observation checklist bridges the two doors: a provider doing a jump start notes "brake pads are worn" → customer gets a follow-up notification → books a diagnostic appointment. Front Door 1 feeds Front Door 2 organically.

**Innovation type:** Category convergence creating a blue ocean position with no direct competitor.

**3. Rideshare Driver Flywheel — Quadruple-Value User**

Most marketplace users occupy one role: buyer OR seller. Uber drivers don't use Uber for rides (they drive for Lyft and ride for Uber, or vice versa). DoorDash dashers don't order DoorDash more than average consumers.

RoadSide ATL's rideshare flywheel creates a user who occupies four revenue positions simultaneously:
- **Customer:** Needs roadside help (flat tire at airport staging, $75)
- **Provider:** Does jump starts and lockouts during dead Uber hours ($400+/month)
- **Subscriber:** Rideshare Priority Plan ($39/month, guaranteed sub-20-min response)
- **Recruiter:** Refers other drivers who become providers ($100-200/referral)

One person = $1,679/year. The flywheel is self-reinforcing: the more drivers who join as providers, the faster response times get, which makes the service better for all customers, which creates more customers, some of whom are rideshare drivers, who become providers.

**Innovation type:** Multi-role user economics creating a self-reinforcing growth loop unique to the rideshare × roadside intersection.

**4. B2B-First Revenue Strategy — Inverted Marketplace Launch**

Standard marketplace playbook (Uber, Airbnb, DoorDash): raise capital → subsidize demand and supply → lose money → achieve density → monetize. This requires venture capital.

RoadSide ATL inverts this: sign B2B contracts first (dealerships, apartments, fleets) → generate $6-10K/month predictable revenue → use B2B volume to attract providers → launch consumer side with providers already available → consumer revenue becomes pure margin on top of a covered cost base.

B2B contracts solve the cold-start problem from the demand side AND provide revenue to fund operations. The apartment partnership model is particularly elegant: every resident helped in the parking deck becomes a personal customer at $0 acquisition cost. B2B doesn't just generate revenue — it generates consumer customers.

**Innovation type:** Go-to-market strategy innovation that eliminates the need for venture capital in a marketplace launch.

### Market Context & Competitive Landscape

| Innovation | Nearest Competitor Approach | RoadSide ATL Differentiation |
|---|---|---|
| Trust Tier | Uber/Lyft accept all payment methods, absorb chargebacks | Structural elimination vs. reactive mitigation |
| Two Front Doors | AAA (roadside only), YourMechanic (diagnostics only) | Category convergence — no single competitor to benchmark against |
| Rideshare Flywheel | Uber (driver OR rider, rarely both) | Quadruple-value user with self-reinforcing economics |
| B2B-First Launch | Most marketplaces: consumer-first, VC-funded | Revenue-positive from Month 1, no venture dependency |

**Competitive moat timeline:**
- **Month 1-6:** First-mover advantage in Atlanta. No local competitor combines dispatch + diagnostics + B2B contracts. The moat is simply being there first.
- **Month 6-12:** Provider density becomes the moat. 50+ providers with sub-15-min coverage makes it extremely difficult for a new entrant to match response times without equivalent provider supply.
- **Year 2+:** B2B contract lock-in + provider loyalty (volume bonuses, preferred provider status) + consumer habit + referral network effects. Each layer makes displacement harder.

### Validation Approach

| Innovation | Validation Method | Success Signal | Timeline |
|---|---|---|---|
| Trust Tier | A/B test: Track booking completion rate for Tier 1 (non-card) vs. hypothetical all-payment scenario | Booking completion > 80% for Tier 1 users AND chargeback rate < 0.5% when Tier 2 users unlock cards | Month 1-3 |
| Two Front Doors | Track: Do emergency customers convert to diagnostic customers (and vice versa)? | > 10% of emergency customers book a diagnostic within 6 months; observation → diagnostic conversion > 5% | Month 3-6 |
| Rideshare Flywheel | Track: What % of rideshare customers become providers? What's their multi-role LTV? | > 5% customer-to-provider conversion; quadruple-value users achieve $1,500+ annual value | Month 2-6 |
| B2B-First Launch | Track: Do B2B contracts actually close within 60 days? Does B2B revenue cover fixed costs? | 3+ contracts signed by Month 2; B2B revenue > $6K/month | Month 1-2 |

### Risk Mitigation

| Innovation Risk | What Could Go Wrong | Fallback |
|---|---|---|
| Trust Tier kills conversion | Atlanta is less cash-friendly than assumed; customers abandon booking when they can't use a card | Reduce threshold from 5 to 3 clean completions. Or: allow card with hold/pre-auth for first-time users (funds held but not charged until admin confirms service completion). |
| Two Front Doors confuses positioning | Customers don't understand "roadside AND diagnostics" — brand becomes muddled | Run Front Door 1 and Front Door 2 as separate landing pages with shared infrastructure. Let each door have clear positioning. Unite the brand after both sides have traction. |
| Rideshare flywheel doesn't spin | Rideshare drivers don't convert to providers because the onboarding friction is too high or the earnings aren't compelling | Simplify provider onboarding to < 5 minutes. Guarantee first 5 jobs within first 2 weeks (manually assign if needed). Increase referral bonus to $250. |
| B2B contracts don't close | Dealerships and apartments don't see value or won't commit to contracts | Offer no-commitment per-job pricing (no contract, retail rates). Build proof points with 3-5 free jobs. Pivot to consumer-first if B2B pipeline is empty after 60 days. |

## Real-Time Marketplace Platform Specific Requirements

### Project-Type Overview

RoadSide ATL is a Next.js 16 server-rendered web application operating as a three-sided marketplace (customer, provider, admin) with real-time dispatch and tracking. It's not a pure SPA, not a pure MPA, and not a traditional SaaS — it's a hybrid that needs to perform like a native app for stranded drivers while serving structured content for SEO and supporting complex admin workflows.

**Architecture pattern:** Server-side rendered pages (Next.js App Router) with client-side interactivity for real-time features (WebSocket tracking, live dispatch updates, interactive maps). API layer via Hono running on the same Node.js process.

### Technical Architecture Considerations

**SPA vs. MPA Decision: Hybrid (Already Built)**
- Marketing/SEO pages: Server-rendered (SSR/SSG) — service pages, city landing pages, blog content
- Booking flow: Client-side interactive with server actions — form steps, payment selection, GPS capture
- Real-time tracking: Pure client-side with WebSocket — live map, provider position, ETA updates
- Admin dashboard: Client-side SPA behavior within authenticated layout — charts, tables, filters, batch operations
- Provider portal: Client-side SPA within authenticated layout — job notifications, earnings, availability toggle

**Browser Support Matrix**

| Browser | Version | Priority | Rationale |
|---|---|---|---|
| Chrome Mobile (Android) | Last 2 versions | Critical | ~45% of Atlanta mobile traffic. Stranded drivers are on phones. |
| Safari Mobile (iOS) | Last 2 versions | Critical | ~40% of Atlanta mobile traffic. iPhone dominant in the market. |
| Chrome Desktop | Last 2 versions | High | Admin dashboard (Beel), B2B portal (Derek, Tanya) |
| Safari Desktop | Last 2 versions | Medium | Mac users accessing admin/B2B |
| Firefox Desktop | Last 2 versions | Low | Negligible traffic for this use case |
| Edge Desktop | Last 2 versions | Low | Negligible traffic for this use case |

**Critical constraint:** 85%+ of customer-facing traffic will be mobile. The booking flow and tracking experience must be designed mobile-first. Admin and B2B portals are primarily desktop.

**Responsive Design Requirements**

| Breakpoint | Target | Primary Users |
|---|---|---|
| 320-480px | Mobile (phones) | Customers booking services, providers accepting jobs |
| 481-768px | Tablet / large phone | Occasional — no specific optimization needed |
| 769-1024px | Small laptop | B2B portal users, some admin |
| 1025px+ | Desktop | Admin dashboard, B2B management, financial reporting |

**Mobile-specific constraints:**
- Touch targets minimum 44x44px (Apple HIG) — stranded drivers have shaky hands
- No hover-dependent interactions in customer or provider flows
- GPS permissions prompt must be clear and non-blocking — fallback to manual address entry if denied
- WebSocket must handle mobile background/foreground transitions gracefully
- Minimal data transfer for tracking page — drivers may be on congested cell networks near I-285

### Performance Targets

| Metric | Target | Context |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.0s on 4G mobile | Stranded driver on I-285, possibly poor signal |
| FID (First Input Delay) | < 100ms | Booking flow must respond instantly to taps |
| CLS (Cumulative Layout Shift) | < 0.1 | Map and tracking UI must not jump around |
| TTFB (Time to First Byte) | < 400ms | Server response from Coolify deployment |
| Bundle size (booking flow) | < 200KB gzipped JS | Minimize download on slow connections |
| WebSocket reconnection | < 3s | Mobile network drops are frequent |
| Map tile loading | < 1.5s | Google Maps tiles on tracking page |

**Performance budget:** Total page weight for booking flow must stay under 500KB (HTML + CSS + JS + fonts). No heavy image assets on critical path. Google Maps loaded asynchronously after initial render.

### SEO Strategy

**SEO-critical pages (already built — verify):**

| Page Type | URL Pattern | SEO Goal |
|---|---|---|
| Service pages | `/services/jump-start`, `/services/towing`, etc. | Rank for "jump start Atlanta," "tow truck near me Atlanta" |
| City/area landing pages | `/atlanta`, `/buckhead`, `/decatur`, etc. | Local SEO for neighborhood-level searches |
| Homepage | `/` | Brand + "roadside assistance Atlanta" |
| Diagnostic services | `/services/pre-purchase-inspection` | Rank for "car inspection Atlanta," "pre-purchase inspection near me" |
| Blog/content | `/blog/*` | Long-tail: "what to do when car breaks down," "used car buying checklist" |

**Technical SEO requirements:**
- Structured data (JSON-LD): LocalBusiness, Service, FAQ schemas — already built
- Sitemap.xml: Auto-generated, includes all service and area pages
- robots.txt: Configured to allow search engines, block admin/provider routes
- Meta tags: Dynamic per page (title, description, OG tags)
- Canonical URLs: Prevent duplicate content across area pages
- Mobile-friendly: Google's mobile-first indexing — all pages must pass Mobile-Friendly Test

**SEO skip:** No need for international SEO, hreflang, or multi-language support. Atlanta-only Phase 1-3.

### Accessibility Level

**Target: WCAG 2.1 Level AA** — pragmatic accessibility, not perfection.

| Requirement | Implementation | Priority |
|---|---|---|
| Keyboard navigation | All interactive elements focusable and operable via keyboard | High (admin/B2B) |
| Screen reader support | Semantic HTML, ARIA labels on custom components, live regions for real-time updates | Medium |
| Color contrast | 4.5:1 minimum for text, 3:1 for large text and UI components | High |
| Focus indicators | Visible focus rings on all interactive elements | High |
| Form labels | All form inputs have associated labels (booking flow, provider application) | High |
| Error messages | Form validation errors announced to screen readers | Medium |
| Motion reduction | Respect `prefers-reduced-motion` for map animations and transitions | Low |

**Practical note:** The emergency booking flow must be usable under stress — large tap targets, clear visual hierarchy, minimal cognitive load. This isn't just accessibility; it's good UX for panicked drivers.

### Permission Model (RBAC)

**Roles (Already Built — Verify):**

| Role | Access | Key Capabilities |
|---|---|---|
| `customer` | Customer-facing pages, own bookings, own profile | Book services, track provider, manage payment methods, view history, manage subscription |
| `provider` | Provider portal, assigned jobs, own earnings | Accept/decline jobs, update status, view earnings, manage availability, submit observations |
| `admin` | Full admin dashboard, all data | Manage bookings, confirm payments, process payouts, approve providers, configure pricing, activate Storm Mode, view all analytics |
| `b2b_account` (new) | B2B portal, own account bookings, invoices | Request services, view invoices, manage contract details, dispatch on behalf of residents/customers |

**Permission boundaries:**
- Customers cannot see provider earnings or admin controls
- Providers cannot see customer payment details or other provider earnings
- B2B accounts see only their own bookings and invoices
- Admin sees everything — no role above admin in Phase 1 (Beel is the only admin)
- Provider self-registration creates a `provider` role pending admin approval — no access to provider portal until approved

**Dual-role support:** A user can be both `customer` AND `provider` (Andre's flywheel). UI switches context based on active role. Single account, dual capability.

### Subscription Tiers (Phase 2 — Architecture Now)

| Tier | Price | Target User | Benefits |
|---|---|---|---|
| RoadSide Pass | $14.99/month | Frequent drivers (Keisha) | $0 dispatch fee, priority queue, 10% off all services |
| Rideshare Priority Plan | $39/month | Rideshare drivers (Andre) | Guaranteed sub-20-min response, 1 free basic service/month |
| Vehicle Health Plan | $29/month | Used car owners (Darius) | Quarterly diagnostic scan, priority dispatch, 10% off |

**Technical architecture:**
- Stripe Subscriptions API for recurring billing
- Subscription status stored in user profile (`active`, `cancelled`, `past_due`, `trialing`)
- Benefit enforcement at booking time: dispatch priority flag, discount calculation, free service counter
- Webhook handlers for: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- Self-service: subscribe, upgrade/downgrade, cancel from customer dashboard
- Admin: subscriber list with filters, MRR calculation, churn tracking

### Real-Time Infrastructure

**WebSocket Architecture (Already Built — Harden):**

| Component | Technology | Purpose |
|---|---|---|
| Server | `ws` library on Node.js | WebSocket server running alongside Hono API |
| Client | Native WebSocket API | Browser-side connection for tracking |
| Authentication | Session token passed on connection | Verify customer/provider identity |
| Channels | Booking-scoped rooms | Each active booking = one channel (customer + provider) |

**Real-time data flow:**
1. Customer creates booking → server creates WebSocket channel for booking ID
2. Provider accepts job → joins booking channel
3. Provider app sends GPS coordinates every 5 seconds → server broadcasts to customer
4. Status updates (en route, arrived, in progress, completed) → broadcast to all channel members
5. Booking completed → channel closed, WebSocket connection released

**Scaling consideration:** At Phase 1 volume (5-10 active bookings), a single WebSocket server handles everything. At Phase 4 (15-22/day, with ~30-minute average job duration), expect 5-8 concurrent WebSocket connections peak. No need for Redis pub/sub or Socket.io clustering until 50+ concurrent connections.

### Integration Architecture

**API Layer (Hono on Node.js):**

| Pattern | Implementation |
|---|---|
| API style | REST with JSON payloads |
| Authentication | NextAuth v5 session cookies (browser) + API keys (future B2B API) |
| Validation | Zod schemas on all endpoints |
| Error handling | Structured error responses with codes |
| Rate limiting | Per-IP rate limiting on public endpoints (booking creation: 10/min) |
| Logging | Structured JSON logs with request ID correlation |

**Database (PostgreSQL 16 via Drizzle ORM):**

| Pattern | Implementation |
|---|---|
| ORM | Drizzle ORM with type-safe queries |
| Migrations | Drizzle Kit migration files (versioned, checked into git) |
| Connection pooling | Drizzle's built-in pooling (sufficient for Phase 1-3 volume) |
| Indexes | On: booking status, provider availability, user email, payment status, created_at |
| Soft deletes | NOT used — hard deletes with audit log for financial records |

### Implementation Considerations

**Deployment (Coolify on VPS):**
- Single Docker container running Next.js + Hono + WebSocket
- PostgreSQL managed by Coolify (same VPS or separate)
- Health check endpoint at `/api/health` (already built)
- Zero-downtime deploys via Coolify's rolling update
- Environment variables managed via Coolify dashboard
- SSL termination via Coolify's Traefik proxy

**Development workflow:**
- Branch-based development, PR to main
- TypeScript strict mode across entire codebase
- Drizzle migrations for all schema changes
- No ORM bypass — all DB access through Drizzle

**Monitoring (Phase 1 — Minimal):**
- Coolify built-in container monitoring (CPU, memory, restarts)
- Health check endpoint polled every 30s
- Error logging to stdout (Coolify captures container logs)
- Manual monitoring by Beel during morning check

**Monitoring (Phase 2+ — Add as needed):**
- Structured logging with log aggregation (consider Axiom or Betterstack)
- Uptime monitoring with alerting (UptimeRobot or similar)
- Error tracking (Sentry) for client-side JS errors
- Analytics (PostHog or Plausible) for booking funnel conversion

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach: Revenue MVP**

This is not a "learn if users want this" MVP. The product brief's B2B-first strategy means MVP must generate real revenue from day one. The MVP philosophy is: **ship the minimum that takes real money from real customers, pays real providers, prevents fraud, and gives Beel operational visibility.** Learning happens through live transactions, not beta testers.

**Why Revenue MVP (not Experiment MVP):**
- B2B contracts are already in the pipeline — dealerships and apartments need service NOW
- The platform is 85% built — this is feature expansion on a brownfield codebase, not a ground-up build
- Provider supply depends on revenue confidence — providers won't stay if the platform isn't transacting
- The cold-start problem is solved by B2B contracts generating guaranteed demand

**Resource Requirements:**
- **Team:** Solo founder (Beel) + AI-assisted development
- **MVP build estimate:** 7-9 dev days for 9 new features on existing codebase
- **Infrastructure:** Existing Coolify deployment, PostgreSQL, Stripe account — no new infrastructure required
- **External dependencies:** None blocking MVP. All integrations (Stripe, Twilio, Resend, Google Maps) already built.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported in MVP:**

| Journey | MVP Support | What Works | What's Manual/Deferred |
|---|---|---|---|
| Keisha (Emergency) | Full | Booking, dispatch, tracking, payment, referral | — |
| Darius (Diagnostics) | Full | Scheduled booking, tiered products, PDF report | Seller-side certificates deferred |
| Andre (Flywheel) | Partial | Customer side full. Provider onboarding works. | Starter kit sold offline. Subscription billing Phase 2. |
| Derek (Dealership) | Partial | Bookings and priority dispatch. | B2B invoicing manual (admin generates). Contract management informal. |
| Marcus (Provider) | Full | Application, approval, job flow, earnings tracking | Volume bonuses Phase 2 |
| Beel (Admin) | Full | Payment confirmation, payouts, revenue view, provider management | Advanced financial reporting Phase 2 |
| Keisha Returns (Edge) | Full | Dispatch cascade, Trust Tier progression | — |
| Tanya (Apartment) | Partial | Service requests via admin. | Self-service B2B portal Phase 2. |
| Payment Dispute | Partial | Admin resolves manually via booking records | Structured dispute queue Phase 2 |
| Lisa (Insurance) | Not in MVP | — | Phase 4 |

**Must-Have Capabilities (9 Features):**

| # | Feature | Effort | Blocks | Can It Be Manual? |
|---|---|---|---|---|
| 1 | Trust Tier Payment System | 1-2 days | Going live with card payments | No — must be automated. Manual bypass defeats the purpose. |
| 2 | Time-Block Pricing | 0.5 day | After-hours revenue capture | Could be manual but error-prone. Automate. |
| 3 | Tiered Commission by Service | 0.5 day | Fair provider compensation | Wrong payouts = provider churn. Automate. |
| 4 | Payment Flow Hardening | 1-2 days | Operational sanity at >10 bookings/week | Currently semi-manual. Hardening prevents spreadsheet hell. |
| 5 | Financial Reporting | 1 day | Answering "is the business working?" | Could use Stripe dashboard but lacks breakdown. Build. |
| 6 | Booking Flow: Now + Scheduled | 1 day | Diagnostic appointments AND emergency bookings | Single booking component with mode toggle — `immediate` or `scheduled`. Date/time picker + location override added to existing flow. Covers both emergency and diagnostic use cases. |
| 7 | Post-Service Referral Text | 0.5 day | Organic growth engine | Doesn't scale past 5 bookings/week manually. Automate. |
| 8 | Vehicle Observation Checklist | 0.5 day | Front Door 1 → Front Door 2 bridge | Structured checklist enables automated follow-up. |
| 9 | Branded Inspection Report (PDF) | 1-2 days | Diagnostic product value | The report IS the product. No shortcut. |

**Feature Dependency Chain:**

```
Trust Tier → Payment Flow Hardening → Financial Reporting
                                    ↘ Tiered Commission
Booking Flow (Now + Scheduled) → Branded PDF Report
Time-Block Pricing (independent)
Referral Text (independent)
Vehicle Observation Checklist (independent)
```

**Critical path:** Trust Tier + Payment Flow Hardening must ship first — they gate every transaction. Booking flow enhancement and PDF can be built in parallel.

**Already Built — Verify & Harden:**
12 existing platform features confirmed functional under production load. Key verification: WebSocket stability under concurrent connections, Stripe webhook resilience, Coolify deployment health checks.

### Post-MVP Features

**Phase 2 (Month 2-4) — Revenue Expansion:**

| Feature | Business Case | Dependency |
|---|---|---|
| Subscription Billing (3 tiers) | Recurring revenue stabilizes cash flow. Target: $3K MRR by Month 4. | Stripe Subscriptions API integration |
| B2B Invoicing & Contracts | Automates Derek/Tanya's billing. Removes admin bottleneck. | B2B account type in user model |
| Surge/Event Pricing (Storm Mode) | Ice storms = 3-5x normal demand. Missing surge pricing leaves $5K+ on the table per event. | Time-Block Pricing foundation (MVP) |
| Provider Volume Bonuses | Retention tool. Uber's 96% 12-month churn is driven by pay dissatisfaction. | Tiered Commission foundation (MVP) |
| Referral Credit System | $15 both ways. Scales referral from text-only to credit-tracked. | Referral Text foundation (MVP) |
| Seller-Side Certificates | Doubles addressable diagnostic market (buyer + seller). | Booking Flow + PDF Report (MVP) |
| Pre-Paid Credits | Eliminates disputes entirely for funded transactions. | Georgia stored-value regulation review required |

**Phase 3 (Month 4-8) — Market Expansion:**

| Feature | Business Case | Dependency |
|---|---|---|
| OTP Zone Expansion | Atlanta metro has ~5M vehicles; ITP is only 30% of population. | Provider density sufficient in ITP first |
| Provider Territory Ownership | Prevents provider cannibalization as network grows. | 30+ active providers |
| Service Stacking | Multi-job routing increases provider utilization. | Sufficient job volume (40+ bookings/week) |
| Provider Leaderboard | Gamification for retention. Pushes past Uber's 4% 12-month cliff. | Rating system + volume data |
| Roadside Warranty ($199/year) | Insurance-like product with recurring revenue. | Actuarial data from Phase 1-2 claims |
| Weather API Storm Mode | Auto-activation vs. manual toggle. | Storm Mode manual (Phase 2) |

**Phase 4 (Month 8-12) — Market Dominance:**

| Feature | Business Case | Dependency |
|---|---|---|
| Insurance Dispatch API | $5K-15K/month guaranteed-payment revenue per partnership. | API infrastructure, enterprise sales cycle |
| Claims-Based Renewal Pricing | Reward low-usage subscribers with lower rates. | 12+ months subscription data |
| Fleet Self-Service Portal | Reduces admin overhead for fleet accounts. | B2B Invoicing (Phase 2) |
| Mobile App (iOS/Android) | PWA sufficient through Phase 3. Native app for push reliability. | User base justifies app store investment |
| Provider Training Platform | Standardize quality as network scales past 50 providers. | Training content creation |

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| WebSocket instability under load | Tracking fails for active bookings — customer sees stale provider location | Load test with 10 concurrent WebSocket connections before launch. Fallback: polling endpoint every 10s if WebSocket drops. |
| PDF generation performance | Inspection reports slow to generate, blocking post-service email | Generate async (queue-based). Customer gets "report generating" message, email within 2 hours. |
| Trust Tier bypass bug | New customer pays by card, chargebacks follow | Automated test: create Tier 1 user, attempt Stripe checkout, verify 403. Run on every deploy. |
| Stripe webhook missed | Payment confirmed but platform doesn't know — provider not paid | Dead-letter queue + admin alert when webhook delivery fails. Manual reconciliation fallback. |

**Market Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| B2B contracts don't close in 60 days | Revenue floor doesn't exist — burns through savings | Offer no-commitment per-job pricing. 3-5 free demo jobs. If zero contracts after 60 days, pivot to consumer-first with aggressive Google Ads ($50/day budget). |
| Provider supply too thin (<3 active) | Response times > 30 min — customer experience fails | Guarantee minimum hourly rate for first 5 providers during first 30 days ($20/hour floor). Manual dispatch for first 50 bookings to ensure quality. |
| Atlanta cash/CashApp culture overstated | Trust Tier kills > 30% of bookings | Monitor booking abandonment at payment step. If > 20% abandon, reduce threshold to 3 completions or add card-with-hold option. |
| Diagnostic demand is weak | Front Door 2 doesn't generate meaningful revenue | If < 5 diagnostic bookings in first 60 days, double down on Facebook Marketplace ads before cutting the feature ($200/month test). |

**Resource Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Solo founder capacity ceiling | Can't handle dev + sales + operations + support simultaneously | Week 1-2 = build MVP features. Week 3-4 = B2B sales (3 contracts). Week 5+ = operational mode (15-min morning check). |
| Feature creep during MVP build | 9-day estimate becomes 30 days | The 9 features are defined. No new features until all 9 ship and 3 B2B contracts are signed. Hard stop. |
| Admin workload scales linearly | At 75 bookings/week, morning check becomes 2-hour session | Phase 2 automation must ship before volume exceeds 30 bookings/week. |

**Absolute Minimum Viable Launch (if resources are severely constrained):**

If the 9-feature MVP is too much, these 4 features enable the first dollar of revenue:

1. **Trust Tier** — without it, card payments = chargebacks
2. **Tiered Commission** — without it, provider payouts are wrong
3. **Payment Flow Hardening** — without it, admin can't confirm payments and trigger payouts
4. **Post-Service Referral Text** — without it, every customer is a dead end with no growth engine

These 4 features (~3 dev days) plus the existing platform = minimum revenue-capable product with organic growth. Emergency roadside only — no diagnostics, no scheduling. Front Door 1 first, prove it works, then layer on Front Door 2.

## Functional Requirements

### Service Booking & Dispatch

- **FR1:** Customers can book emergency roadside services by selecting a service type and confirming their location
- **FR2:** Customers can book scheduled services by selecting a service type, location, date, and time
- **FR3:** The system can auto-detect the customer's GPS location and pre-fill the booking location field
- **FR4:** Customers can manually enter or override their location if GPS is unavailable or inaccurate
- **FR5:** The system can auto-dispatch the nearest available provider matching the requested service type
- **FR6:** The system can cascade dispatch to the next nearest provider when the first provider declines or times out
- **FR7:** The system can apply priority dispatch for B2B contract accounts and subscription holders
- **FR8:** Customers can select from tiered diagnostic products (Basic, Standard, Premium) during booking
- **FR9:** Customers can view transparent pricing including time-block multipliers before confirming a booking
- **FR10:** The system can apply time-block pricing multipliers automatically based on the time of booking (Standard, After-Hours, Emergency)
- **FR11:** Customers can cancel a booking before a provider is dispatched *(Source: operational edge case — prevents orphaned dispatch when customer resolves issue independently)*
- **FR12:** The system can expand the provider search radius if no provider is available within the default range *(Source: dispatch reliability — prevents failed dispatch in low-provider-density areas, supports OTP expansion in Phase 3)*

### Payment & Financial Operations

- **FR13:** The system can restrict new customers (Trust Tier 1) to non-reversible payment methods only (Cash, CashApp, Zelle)
- **FR14:** The system can unlock card payment access for customers who complete a configurable number of clean transactions
- **FR15:** Customers can view their Trust Tier progress and current payment method eligibility
- **FR16:** Admins can manually promote or demote a customer's Trust Tier status
- **FR17:** Customers can pay for services using Cash, CashApp, Zelle, or credit card (based on Trust Tier eligibility)
- **FR18:** Admins can confirm manual payment receipt (CashApp, Zelle, Cash) for completed bookings
- **FR19:** The system can calculate provider payouts using service-category-specific commission rates
- **FR20:** Admins can process provider payouts individually or in batches
- **FR21:** The system can generate payment receipts and email them to customers upon payment confirmation
- **FR22:** Admins can initiate partial or full refunds with corresponding provider payout adjustments
- **FR23:** The system can apply surge/event pricing multipliers when Storm Mode is activated by admin *(Source: Journey 6 — Beel activates Storm Mode during ice storm; customer-facing pricing transparency from Success Criteria)*
- **FR24:** Admins can view revenue analytics broken down by source (B2B/B2C), service category, payment method, and time-block tier
- **FR25:** The system can generate audit log entries for all financial mutations (payment confirmations, payouts, refunds, Trust Tier changes)

### Real-Time Tracking & Communication

- **FR26:** Customers can track the dispatched provider's location in real-time on a live map
- **FR27:** Customers can view the provider's name, photo, rating, and estimated time of arrival
- **FR28:** The system can broadcast provider GPS position updates to the customer during active bookings
- **FR29:** The system can send automated delay notifications when provider ETA exceeds a configurable threshold
- **FR30:** The system can send booking confirmation notifications via SMS and email
- **FR31:** The system can send provider assignment notifications to both customer and provider
- **FR32:** The system can send service completion notifications to the customer
- **FR33:** The system can send automated referral link via SMS within a configurable time after service completion
- **FR34:** The system can send Trust Tier progression notifications when a customer unlocks card payment

### Provider Management

- **FR35:** Prospective providers can submit an application with personal information, vehicle details, insurance verification, service area, and available hours
- **FR36:** Admins can review, approve, deny, or request resubmission for provider applications
- **FR37:** Providers can toggle their availability status (online/offline)
- **FR38:** Providers can configure their service area by zone
- **FR39:** Providers can receive job notifications with service type, distance, price, and their payout amount
- **FR40:** Providers can accept or decline job notifications within a configurable timeout
- **FR41:** Providers can update job status through the service lifecycle (en route, arrived, in progress, completed)
- **FR42:** Providers can view their earnings (per-job breakdown, daily, weekly, monthly totals)
- **FR43:** Providers can view their commission tier and how service category affects their payout percentage
- **FR44:** Providers can submit vehicle observation notes and photos during or after service
- **FR45:** Providers can upload pre-service photos for documentation purposes
- **FR46:** Providers can view their rating and review history
- **FR47:** Providers can refer other providers and track referral status

### Customer Account & Trust

- **FR48:** Customers can create an account after their first booking (guest booking supported for first service)
- **FR49:** Customers can authenticate via Google OAuth or email/password credentials
- **FR50:** Customers can view their booking history and service records
- **FR51:** Customers can view and manage their payment methods
- **FR52:** Customers can rate and review their provider after service completion
- **FR53:** Customers can view and share their unique referral link
- **FR54:** Customers can receive and redeem referral credits on future bookings *(Source: Journey 1 referral text → credit lifecycle; Success Criteria referral share rate > 25%)*
- **FR55:** A user can hold both customer and provider roles simultaneously on a single account

### B2B Account Management

- **FR56:** Admins can create and manage B2B business accounts with company profiles (name, billing address, contact, payment terms)
- **FR57:** Admins can configure B2B contracts with retainer amounts, per-job rates, included services, and contract dates
- **FR58:** B2B account holders can request services on behalf of their residents or customers
- **FR59:** The system can tag bookings to B2B business accounts for consolidated billing
- **FR60:** The system can generate monthly itemized invoices for B2B accounts
- **FR61:** Admins can track invoice status (draft, sent, paid, overdue) for B2B accounts
- **FR62:** The system can send invoice notifications via email to B2B billing contacts
- **FR63:** The system can notify residents/customers of incoming service dispatched by their B2B account holder

### Diagnostics & Inspection

- **FR64:** Customers can book pre-purchase vehicle inspections at a specified location, date, and time
- **FR65:** Customers can select from tiered inspection products with clearly displayed features and pricing
- **FR66:** The system can send pre-service confirmation with inspector name and arrival time
- **FR67:** Providers can capture and submit inspection findings including OBD2 data, photos, and measurements
- **FR68:** The system can generate a branded PDF inspection report from submitted findings
- **FR69:** The system can email the branded inspection report to the customer within a configurable time after completion
- **FR70:** Providers can submit structured vehicle observation checklists during any service type (not just diagnostics)
- **FR71:** The system can trigger follow-up notifications to customers based on provider observations (e.g., "battery may need replacement")

### Platform Administration

- **FR72:** Admins can view a dashboard with pending payments, payout queue, revenue analytics, provider status, and booking overview
- **FR73:** Admins can configure Trust Tier thresholds (number of completions required for card unlock)
- **FR74:** Admins can configure commission rates per service category
- **FR75:** Admins can configure time-block pricing windows and multiplier percentages
- **FR76:** Admins can activate and deactivate Storm Mode with configurable surge multipliers and start/end times
- **FR77:** Admins can select from pre-built Storm Mode templates (Ice Storm, Falcons Game, Holiday Weekend)
- **FR78:** Admins can view and manage all active, completed, and cancelled bookings
- **FR79:** Admins can add internal notes to booking records (not visible to customers)
- **FR80:** Admins can configure provider checklists with required steps per service type
- **FR81:** Admins can view system health information (WebSocket status, deployment health)
- **FR82:** Admins can export provider earnings data in 1099-ready format annually *(Source: Domain Requirements — IRS independent contractor compliance, 1099-NEC filing obligation)*
- **FR83:** Admins can override pricing on individual bookings *(Source: operational edge case — handles B2B custom pricing, dispute resolution adjustments, goodwill credits)*

## Non-Functional Requirements

### Performance

- **NFR1:** Page load time (LCP) shall be < 2.0 seconds on 4G mobile connections as measured by Lighthouse and real user monitoring
- **NFR2:** API response time shall be < 340ms at p95 under normal load as measured by server-side APM
- **NFR3:** Booking-to-dispatch cycle shall complete in < 5 seconds end-to-end (server-side matching < 500ms + notification delivery)
- **NFR4:** First Input Delay (FID) shall be < 100ms on mobile devices
- **NFR5:** Cumulative Layout Shift (CLS) shall be < 0.1 across all customer-facing pages
- **NFR6:** Time to First Byte (TTFB) shall be < 400ms from the deployment environment
- **NFR7:** Booking flow total page weight shall be < 500KB (HTML + CSS + JS + fonts) with Google Maps loaded asynchronously
- **NFR8:** WebSocket reconnection after mobile network drop shall complete in < 3 seconds with exponential backoff and jitter
- **NFR9:** GPS position update delivery latency shall be < 500ms at p95 during active tracking
- **NFR10:** PDF inspection report generation shall complete within 30 seconds and not block the post-service email pipeline

### Security

- **NFR11:** The system shall never store raw credit card numbers — all card data handled exclusively through Stripe tokenization
- **NFR12:** Trust Tier enforcement shall have zero bypass paths — automated test coverage on every deploy shall verify Tier 1 users cannot access card payment endpoints
- **NFR13:** Provider SSN/EIN data (for 1099 reporting) shall be encrypted at rest using AES-256 or equivalent
- **NFR14:** All financial audit log entries shall be immutable — no soft deletes, no modifications after creation
- **NFR15:** Authentication shall enforce session expiration after 24 hours of inactivity with re-authentication required
- **NFR16:** API rate limiting shall enforce 10 requests/minute on booking creation endpoints per IP address
- **NFR17:** Admin routes shall be inaccessible to customer and provider roles — server-side RBAC enforcement on every request
- **NFR18:** WebSocket connections shall require authenticated session tokens — unauthenticated connections rejected immediately
- **NFR19:** Provider GPS location data shall only be transmitted to customers during active bookings — no background tracking, no retention beyond booking lifecycle
- **NFR20:** CashApp/Zelle transaction IDs shall be logged for reconciliation but no bank account details stored in the database

### Scalability

- **NFR21:** The system shall support 50 simultaneous active bookings in Phase 1 without degradation
- **NFR22:** The system shall support 200 simultaneous active bookings by Phase 4 through horizontal scaling capability
- **NFR23:** WebSocket server shall handle 50 concurrent connections in Phase 1 with upgrade path to 200+ via pub/sub message broker if needed
- **NFR24:** Database queries on booking, payment, and provider tables shall maintain < 100ms response time with proper indexing at 100K+ booking records
- **NFR25:** Google Maps API usage shall be optimized to < 900 calls/week at Phase 4 volume (150 bookings/week) through client-side caching and batched distance matrix requests
- **NFR26:** SMS notification throughput shall support 600+ messages/week at Phase 4 volume (150 bookings × 4 messages/booking)
- **NFR27:** The database schema shall support multi-tenant B2B account isolation without schema changes as B2B accounts scale from 3 to 50+
- **NFR28:** Stripe webhook processing shall handle burst delivery of up to 100 events/minute during payment reconciliation windows

### Reliability

- **NFR29:** System uptime shall be > 99.5% monthly (< 3.6 hours/month planned maintenance) as measured by health check monitoring
- **NFR30:** Active booking state shall persist to the database — application restarts shall recover all in-progress bookings without data loss
- **NFR31:** Database automated backups shall run every hour with Recovery Point Objective (RPO) < 1 hour
- **NFR32:** Lost booking rate shall be 0% — every submitted booking shall persist through database-level constraints and application-level validation
- **NFR33:** Stripe webhook delivery shall achieve 99.99%+ reliability with dead-letter queue for failed deliveries and admin alerting
- **NFR34:** Double-charge rate shall be 0% — idempotency keys enforced on every payment operation
- **NFR35:** Manual payment confirmation (CashApp/Zelle/Cash) shall be processed within 4 hours of receipt
- **NFR36:** Auto-dispatch failover shall trigger within 2 minutes when the primary provider declines or times out, with configurable cascade depth
- **NFR37:** Health check endpoint (`/api/health`) shall respond within 5 seconds and cover database connectivity, WebSocket server status, and Stripe API reachability
- **NFR38:** WebSocket heartbeat/keepalive shall fire every 20 seconds to prevent proxy timeout disconnections

### Accessibility

- **NFR39:** All customer-facing pages shall conform to WCAG 2.1 Level AA standards
- **NFR40:** All interactive elements shall be keyboard-navigable with visible focus indicators
- **NFR41:** Color contrast ratio shall meet 4.5:1 minimum for normal text and 3:1 for large text and UI components
- **NFR42:** All form inputs shall have associated labels — form validation errors announced to screen readers via ARIA live regions
- **NFR43:** Touch targets on mobile shall be minimum 44x44px per Apple HIG — critical for stressed users in emergency situations
- **NFR44:** No hover-dependent interactions in customer or provider flows — all actions achievable via tap/click
- **NFR45:** Map animations and transitions shall respect the `prefers-reduced-motion` user preference

### Integration

- **NFR46:** All API endpoints shall validate request payloads using schema validation with structured error responses including error codes
- **NFR47:** All database access shall go through the ORM layer — no raw SQL queries outside of migrations
- **NFR48:** Stripe integration shall use webhook signature verification on every incoming event to prevent spoofing
- **NFR49:** SMS notifications (Twilio) shall include delivery status tracking with retry logic for failed sends
- **NFR50:** Email notifications (Resend) shall use templated content with unsubscribe links per CAN-SPAM compliance
