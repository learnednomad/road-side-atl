---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow_completed: true
inputDocuments:
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
  - _bmad-output/brainstorming/brainstorming-session-2026-02-11.md
date: 2026-02-11
author: Beel
---

# Product Brief: road-side-atl

## Executive Summary

RoadSide ATL is a 24/7 on-demand vehicle services platform launching in the Atlanta metro area with plans to scale nationally. It solves a simple problem: when drivers need help with their car, every existing option — AAA memberships, insurance hold times, random tow companies on Google — requires them to be prepared for a moment nobody prepares for. RoadSide ATL eliminates that friction entirely. Book in 60 seconds. Helped in 20 minutes. No membership. No policy number. No hold time.

The platform serves two moments of vehicle anxiety through a single trust relationship. Front Door 1: "My car just broke down" — instant booking, auto-dispatch, real-time GPS tracking, sub-20-minute response. Front Door 2: "I'm about to buy a used car" — on-demand pre-purchase inspections with tiered safety net products. No competitor occupies both categories. Roadside companies don't do diagnostics. Diagnostic shops don't build dispatch marketplaces. RoadSide ATL sits in the blue ocean between them.

Starting in Atlanta — 6M+ metro population, 1.79M registered vehicles, the nation's 4th-worst traffic bottleneck — the platform targets the 67% of drivers who have roadside coverage but never use it because activating it is harder than being stranded. A B2B-first revenue strategy (dealership contracts, apartment partnerships, fleet retainers) covers fixed costs before the first consumer ad dollar is spent. A rideshare driver flywheel solves both provider supply and customer acquisition simultaneously. Atlanta proves the model; the playbook replicates city by city.

---

## Core Vision

### Problem Statement

A driver is stranded on I-285 at 11PM. Battery's dead. Phone at 12%. They Google "roadside help Atlanta." AAA — needs a membership they don't have. Insurance — needs a policy number they can't find. A tow company — cash only, no ETA, no tracking, no accountability. They're standing on the shoulder of the most dangerous highway in the Southeast, and every existing solution requires them to be prepared for a moment nobody prepares for.

Meanwhile, across town, someone's about to hand $5,000 cash to a stranger on Facebook Marketplace for a used car. They have no way to know if the engine is sound, the transmission is failing, or the check engine light was cleared an hour ago. Their options: trust the seller, bring a "friend who knows cars," or pay a mobile mechanic from Craigslist they've never met. No trusted, affordable, on-demand inspection service exists.

Both moments share the same root anxiety: **Can I trust my car?** And in both moments, drivers have nowhere trustworthy to turn.

### Problem Impact

- **Safety risk:** Every minute stranded on Atlanta's highways is dangerous. I-285 carries 2M vehicles/day. Breakdowns on high-speed corridors create secondary accident risk, especially at night. The average driver experiences 3-5 breakdowns in a vehicle's lifetime — and each time, the experience is terrible.
- **Financial risk:** 40% of private-party used car purchases involve undisclosed mechanical issues. Buyers lose thousands because affordable on-demand inspections don't exist. Sellers lose deals because buyers don't trust them.
- **Provider invisibility:** Skilled independent tow truck drivers and mobile mechanics rely on word-of-mouth and police rotation lists. No digital presence, no way to fill downtime, no professional job management system.
- **Market scale:** US roadside assistance market: $2.31B (2024), growing 4.9% CAGR to $3.69B by 2034. Pre-purchase vehicle inspections barely exist as a formalized category. Atlanta alone represents a $50M+ combined addressable market.

### Why Existing Solutions Fall Short

| Competitor | Gap |
|---|---|
| **AAA** | Membership required ($56-164/year). Policy lookup friction. 45-60 min average response. No real-time tracking. No diagnostics. National call center — not local dispatch. |
| **Insurance add-ons** | Bundled into policies drivers forget they have. Same call center friction. Limited to 3-4 calls/year. Zero transparency on who's coming or when. |
| **Honk / Urgently** | B2B dispatch platforms powering insurance companies — not consumer-facing. Driver never sees the brand or builds a relationship. |
| **Local tow companies** | Cash-only, no digital booking, no tracking, unpredictable pricing, no accountability or review system. |
| **Mobile mechanics / Craigslist** | Informal trust networks. No standardized inspections, no branded reports, no platform accountability. The real competition for diagnostics. |

The common thread: every existing solution either gates access behind friction (memberships, policies, hold times) or offers no accountability (random tow trucks, Craigslist mechanics). No single player combines instant digital booking, auto-dispatch, real-time tracking, flexible payment, emergency roadside, AND pre-purchase diagnostics.

### Proposed Solution

**The platform drivers trust when they need help with their car — whether it just broke down or they're making sure it won't.**

**Front Door 1 — Emergency Rescue:**
1. 60-second booking — select service, enter location, done. No membership, no phone call.
2. Auto-dispatch — GPS algorithm finds nearest available provider with the right specialty.
3. Real-time tracking — live map with provider location, ETA, status updates.
4. Flexible payment — Cash, CashApp, Zelle, credit card (earned via Trust Tier). Meeting Atlanta's market where it is.
5. Target: sub-20-minute response in core zones. That's 3x faster than AAA's metro average.

**Front Door 2 — Vehicle Diagnostics:**
1. On-demand pre-purchase inspections — "We come to the car, wherever it is."
2. Tiered products — Basic inspection ($250), Standard + tow-if-fails ($325), Premium + 72-hour guarantee ($400).
3. Seller-side certificates — doubles the addressable market (every transaction has a buyer AND a seller).
4. Dealership bulk contracts — embedded inventory inspection partnerships.

**Platform Infrastructure:**
- Two-tier provider network: heavy-service (tow companies) and light-service (rideshare drivers with starter kits).
- Trust Tier Payment System — new customers use non-reversible methods; card access earned after proven reliability.
- B2B revenue floor — dealership, apartment, and fleet contracts create predictable monthly revenue before consumer launch.
- Commission-based marketplace with tiered rates by service category.

### Key Differentiators

1. **Zero-Friction Access** — Book in 60 seconds, helped in 20 minutes. No membership, no policy, no hold time. Competing on speed and simplicity against every friction-gated incumbent.
2. **Two Front Doors, One Platform** — Emergency roadside and pre-purchase diagnostics serve the same human anxiety ("Can I trust my car?") through different entry points. No competitor occupies both categories. Blue ocean positioning.
3. **Trust Tier Payment System** — Proprietary chargeback elimination: new customers use non-reversible payment methods, earning credit card access after clean completions. Protects margins from day one.
4. **Hyper-Local Atlanta Expertise** — I-285 corridor pre-positioning, neighborhood marketing, weather-event playbooks. National players can't out-local a platform built for Atlanta's specific geography.
5. **Rideshare Driver Flywheel** — One person = customer + provider + subscriber + recruiter ($1,679/year). Solves provider supply and customer acquisition simultaneously.
6. **B2B-First Revenue Strategy** — Dealership and apartment contracts generate $6K-10K/month before the first consumer ad dollar. Consumer revenue becomes pure margin.

## Target Users

### Primary Users

#### B2C Consumers

**Persona 1: Keisha — The Stranded Commuter**

- **Who:** 32, marketing coordinator, drives a 2017 Honda Civic. Lives in East Atlanta, commutes to Buckhead daily via I-85/I-285.
- **Context:** 67% of Atlanta drivers have some form of roadside coverage but never use it. Keisha is one of them — she has an insurance add-on she's never activated and wouldn't know how to if she needed it.
- **Problem moment:** Dead battery in the office parking deck at 7PM. Googles "jump start near me Atlanta." Finds AAA (needs membership), her insurance (15-minute hold, needs policy number from glove box she can't access), and a tow company with no reviews and "cash only."
- **Success looks like:** Opens RoadSide ATL, taps "Jump Start," confirms her location, and sees "Marcus is 8 minutes away" on a live map. Car started in 20 minutes. Pays with CashApp. Gets a text: "Friend gets $15 off their first service."
- **Emotional driver:** Relief and control during a vulnerable moment.
- **Lifetime value:** 1-2 emergency calls/year ($100-250) + potential subscription convert ($14.99/month) + referral source.
- **Marketing channels:** Google Search ("jump start Atlanta," "roadside help near me"), Google Maps local pack, neighborhood Facebook groups, Nextdoor, post-service referral texts, apartment welcome packets.

**Persona 2: Darius — The Used Car Buyer**

- **Who:** 26, warehouse associate, looking to buy his first car on Facebook Marketplace. Budget: $4,000-6,000.
- **Context:** The average vehicle age in the US is 12.8 years — peak breakdown territory. Facebook Marketplace is the #1 used car marketplace for budget buyers. No affordable, on-demand inspection service exists for private-party transactions.
- **Problem moment:** Found a 2014 Nissan Altima for $5,200. Seller says "runs great." Darius has no way to verify. His uncle "knows cars" but lives in Marietta and works weekends. His options are trust the seller or walk away.
- **Success looks like:** Books a Basic Inspection ($250) on RoadSide ATL. Technician meets him at the seller's location, runs OBD2 diagnostics, checks transmission, brakes, tires. Gets a branded PDF report. Transmission shows early failure signs — Darius saves $5,200 and a headache.
- **Emotional driver:** Confidence in a high-stakes financial decision.
- **Lifetime value:** 1-3 inspections/year ($250-400 each) + converts to roadside customer after purchase + referrals to friends also buying cars.
- **Marketing channels:** Facebook Marketplace targeted ads ("Don't buy without an inspection. $250, we come to you"), Instagram reels, Craigslist auto section, used car Facebook groups ("Atlanta Cars for Sale"), Google Search ("pre-purchase car inspection Atlanta").

**Persona 3: Andre — The Rideshare Driver**

- **Who:** 29, full-time Uber/Lyft driver in Atlanta. Drives a 2019 Toyota Camry, 45-50 hours/week. Vehicle is his livelihood.
- **Context:** Tens of thousands of rideshare drivers in Atlanta metro. They're the highest-frequency breakdown demographic (high mileage, long hours) and the most time-sensitive (every minute off-road is lost income). They're also already driving Atlanta with smartphones — making them ideal light-service providers.
- **Problem moment:** Flat tire at Hartsfield-Jackson airport queue at 2AM. Can't afford 45-minute AAA wait — every minute is $1-2 in lost fares. Needs someone NOW.
- **Success looks like:** As a customer — books flat tire change, provider arrives in 12 minutes, back on the road in 30. As a provider — buys the $299 starter kit, starts taking jump start and lockout jobs during slow ride hours. Earns $50-100/shift on top of Uber income. Recruits two driver friends.
- **Emotional driver:** Protecting his income stream. Diversifying revenue.
- **Lifetime value:** $1,679/year (customer $14.99/month subscription + provider commissions + kit purchase $299 + 2 referrals).
- **Marketing channels:** Uber/Lyft driver Facebook groups, airport rideshare staging area flyers, gas station bulletin boards near Hartsfield-Jackson, TikTok/YouTube ("How I make extra money as an Uber driver"), driver subreddits.

**Persona 4: Monique — The Used Car Seller**

- **Who:** 35, nurse, selling her 2016 Ford Escape to upgrade. Listed on Facebook Marketplace for $8,500.
- **Context:** Every used car transaction has TWO potential customers. Sellers face lowball offers, no-shows, and buyers who don't trust them. A pre-sale inspection certificate removes friction from the deal.
- **Problem moment:** Third buyer in a row wants to "bring their mechanic" but never follows through. Listing has been up for 3 weeks. She's making payments on two cars.
- **Success looks like:** Gets a Seller-Side Diagnostic Certificate ($250) from RoadSide ATL. Posts in listing: "Professionally inspected — report available." Car sells in 4 days at asking price. Certificate paid for itself 10x over.
- **Emotional driver:** Speed of sale and price protection.
- **Lifetime value:** 1 inspection per sale cycle ($250) + word-of-mouth to friends selling cars + becomes roadside customer.
- **Marketing channels:** Facebook Marketplace seller tips content, "How to sell your car faster" blog/SEO content, Instagram, car selling Facebook groups.

---

#### B2B Accounts

**Persona 5: Derek — The Independent Dealership Manager**

- **Who:** 44, manages a 3-lot independent used car dealership in Decatur. Moves 30-50 cars/month. No in-house mechanic.
- **Context:** Independent dealerships need lot transfers between locations, pre-sale inspections for inventory, and a roadside solution for customers who buy and break down within the first week.
- **Problem moment:** Bought 8 cars at auction. Needs 3 moved between lots. Needs all 8 inspected before listing. A customer who bought last Tuesday calls — car won't start. Derek's current solution: calling "his guy" who answers maybe 60% of the time.
- **Success looks like:** Dealership Full-Service Package — bulk inspections at $200/each (vs $250 retail), lot transfers at $90/each (vs $125 retail), free 6-month buyer coverage funded by dealer ($50/enrollment). One invoice. One relationship. One platform.
- **Emotional driver:** Operational reliability and reduced customer complaints.
- **Lifetime value:** $4,500/month (10 inspections + 5 transfers + 15 buyer enrollments + ad-hoc roadside).
- **Marketing channels:** Direct outreach (cold call/visit to dealership lots), Auto Dealers Association of Georgia events, LinkedIn, dealer-specific Facebook groups, referral from other dealers, "Dealer Partner Program" landing page.

**Persona 6: Tanya — The Apartment Property Manager**

- **Who:** 38, manages a 200-unit apartment complex in Midtown. Responsible for resident satisfaction and retention.
- **Context:** Parking deck breakdowns are a weekly occurrence. Dead batteries, lockouts, flat tires. Residents call the front desk, property manager has no solution — tells them to "call AAA."
- **Problem moment:** Sunday morning, resident locked out of car in the parking deck. Front desk gets the angry call. No solution to offer. Resident posts 1-star review on Google mentioning parking deck frustrations.
- **Success looks like:** $250/month contract with RoadSide ATL. Unlimited jump starts and lockouts in the parking deck. Branded "Your building is covered by RoadSide ATL" flyers in welcome packets. Residents helped on-site → become personal customers for services outside the complex.
- **Emotional driver:** Resident satisfaction, retention, and competitive amenity.
- **Lifetime value:** $3,000/year (contract) + every resident helped becomes a personal customer (negative acquisition cost).
- **Marketing channels:** Property management association events, LinkedIn outreach to property managers, apartment complex cold visits with one-pager, Apartments.com/Zillow partnership listings mentioning "roadside coverage included," referral from other property managers.

**Persona 7: Marcus (Fleet) — The Delivery Fleet Operator**

- **Who:** 47, owns a 15-vehicle delivery fleet serving Amazon last-mile in south Atlanta.
- **Context:** Fleet vehicles break down regularly. Every vehicle off-road is a missed delivery route and a contract penalty. Current solution: call a tow company, wait, hope.
- **Problem moment:** Two vans down on the same morning — one dead battery in College Park, one flat tire in East Point. Scrambling to cover routes while finding help for both simultaneously.
- **Success looks like:** $500/month retainer with RoadSide ATL. Priority dispatch for all fleet vehicles. Discounted per-job rates. One dashboard showing all active service requests. Guaranteed sub-30-minute response.
- **Emotional driver:** Uptime and operational continuity.
- **Lifetime value:** $6,000/year (retainer) + per-job revenue above retainer + referral to other fleet operators.
- **Marketing channels:** LinkedIn outreach, local logistics/delivery Facebook groups, Amazon DSP owner forums, fleet management conferences, cold outreach to branded delivery vans spotted in Atlanta, Google Search ("fleet roadside service Atlanta").

**Persona 8: Lisa — The Insurance Roadside Coordinator**

- **Who:** 41, regional coordinator for a mid-size auto insurance company covering Georgia.
- **Context:** Insurance companies outsource roadside dispatch to national networks (Agero, Urgently). Response times are slow, customer satisfaction is low, and they have no local dispatch intelligence.
- **Problem moment:** Customer complaints about 60+ minute wait times for roadside claims in Atlanta metro. National dispatch network sends providers from 30 miles away when someone local could arrive in 10 minutes.
- **Success looks like:** Local dispatch partnership — RoadSide ATL handles Atlanta metro roadside claims at negotiated per-job rates. Faster response → higher NPS → lower churn. Guaranteed payment, no disputes.
- **Emotional driver:** Customer satisfaction metrics and operational efficiency.
- **Lifetime value:** $5,000-15,000/month depending on claim volume. Steady, year-round, guaranteed-payment revenue.
- **Marketing channels:** Insurance industry conferences, direct outreach to regional offices, LinkedIn to claims/operations managers, case study showing response time improvement, referral from other insurance partnerships.

---

### Provider Users

**Persona 9: Marcus — The Independent Tow Operator**

- **Who:** 36, owns his own tow truck. 8 years experience. Works the south side of Atlanta. Currently relies on police rotation list and word-of-mouth.
- **Context:** Independent tow operators are skilled but digitally invisible. No app presence, no way to fill downtime, inconsistent income. The good ones are booked; the rest sit idle.
- **Problem moment:** Has 3-hour gaps between jobs with no way to find work. Pays $1,200/month on his truck. Needs consistent volume to cover costs.
- **Success looks like:** Signs up on RoadSide ATL. Gets job notifications pushed to his phone. Accepts jobs that match his route. Fills downtime with platform work. Earns an extra $800-1,200/month. Sees his rating climb and gets "Preferred Provider" status with first dibs on high-value jobs.
- **Emotional driver:** Financial stability and professional recognition.
- **Commission tier:** Heavy services (towing, diagnostics) — 75-80% to provider.
- **Marketing channels:** Tow truck driver Facebook groups, direct cold approach at gas stations/truck stops, tow company overflow partnerships, provider-recruits-provider referral bonus ($100-200), "Free Leads" pitch ("additional jobs you wouldn't have found"), 3-minute demo video of provider dashboard.

**Persona 10: Jaylen — The Rideshare Side-Hustler Provider**

- **Who:** 24, part-time Uber driver, full-time student at Georgia State. Drives 20 hours/week for Uber.
- **Context:** Rideshare drivers already have the key assets: car, smartphone, knowledge of Atlanta streets, flexible schedule. They lack only tools and training for basic roadside services.
- **Problem moment:** Uber surge dies at 2PM on a Tuesday. Sitting in car, burning gas, waiting for rides. Could be earning but has nothing to do.
- **Success looks like:** Buys the $299 Provider Starter Kit (portable jump starter, lockout tools, fuel can, safety vest, branded magnets). Watches 30-minute training video. Starts accepting jump start, lockout, and fuel delivery jobs during Uber dead hours. Earns $50-100 extra per shift. Recruits his roommate.
- **Emotional driver:** Extra income without a second "job."
- **Commission tier:** Light services (jump start, lockout, fuel delivery) — 70% to provider.
- **Marketing channels:** Uber/Lyft driver Facebook groups, TikTok/YouTube content ("Side hustle for rideshare drivers"), campus bulletin boards, rideshare staging area flyers, in-app referral after taking a ride with another driver-provider.

---

### Admin User

**Persona 11: Beel — The Platform Operator**

- **Who:** Founder and admin of RoadSide ATL. Manages the entire platform: provider onboarding, booking oversight, payment confirmations, payout processing, revenue analytics.
- **Context:** Solo operator in early stage. Needs the admin panel to be a complete command center — not just a dashboard, but an operational tool.
- **Core workflows:** Confirm manual payments (CashApp/Zelle/cash), process provider payouts in batches, monitor auto-dispatch, approve pending providers, manage Trust Tier thresholds, review audit logs, track revenue analytics, activate Storm Mode pricing, configure commission tiers.
- **Success looks like:** 15-minute morning check: confirm overnight payments, review new provider applications, check payout queue, glance at revenue trends. Platform runs itself for the other 23 hours and 45 minutes.

---

### User Journey

#### B2C Consumer Journey

| Stage | Stranded Driver (Keisha) | Used Car Buyer (Darius) | Rideshare Driver (Andre) |
|---|---|---|---|
| **Discovery** | Google Search during emergency, apartment welcome packet, friend's referral text | Facebook Marketplace ad, friend recommendation, "car inspection Atlanta" Google search | Uber driver Facebook group, airport staging area flyer, friend who's already a provider |
| **First Touch** | Books service from phone while stranded. No account needed for first booking. | Sees ad while browsing Marketplace listing. Clicks through to booking page. | Sees provider recruitment post. Watches 3-min demo video. |
| **Onboarding** | Guest booking → post-service prompt to create account → Trust Tier begins | Books inspection → creates account at checkout → gets branded PDF report | Signs up as customer first → sees provider opportunity → buys starter kit |
| **Aha Moment** | Provider arrives in 14 minutes. "Where was this last time I was stuck for an hour?" | Report shows transmission issue. "I almost bought a $5,000 problem." | First provider job during Uber dead time. Earns $35 in 20 minutes. "This is better than waiting for rides." |
| **Retention** | Referral text → subscribes to RoadSide Pass ($14.99/month) → becomes regular | Tells friends buying cars → comes back for next purchase → becomes roadside customer | Dual revenue: Uber + RoadSide ATL. Recruits friends. Earns referral bonuses. Hits volume bonus tier. |
| **Advocacy** | Posts in neighborhood Facebook group: "Just got rescued in 12 minutes, no membership needed" | Comments on friend's Marketplace listing: "Get it inspected first, use RoadSide ATL" | Tells other drivers at airport staging: "I made an extra $400 this week doing jump starts" |

#### B2B Account Journey

| Stage | Dealership (Derek) | Apartment (Tanya) | Fleet (Marcus) | Insurance (Lisa) |
|---|---|---|---|---|
| **Discovery** | Cold visit from RoadSide ATL rep with one-pager | LinkedIn outreach or property management event | Google Search or cold outreach spotting branded vans | Insurance conference or direct outreach |
| **Evaluation** | Free trial: 3 inspections at no cost to prove quality | 1-month pilot at $150 (reduced rate) | 2-week trial with 5 free service calls | Pilot program covering one zip code |
| **Conversion** | Signs Dealer Partner agreement: inspections + transfers + buyer coverage | Signs annual contract at $250/month | Signs retainer at $500/month + per-job | Signs regional dispatch partnership |
| **Aha Moment** | Customer buys car, breaks down day 3, covered by dealer-funded plan. Customer grateful, not angry. | Resident locked out Sunday morning, helped in 15 min. Posts 5-star Google review mentioning the amenity. | Two vans down same morning — both fixed within 30 min, no missed routes. | Atlanta NPS jumps 15 points in first quarter. |
| **Expansion** | Adds second lot → refers dealer friend → becomes inspection-only client for auction purchases | Refers sister property → management company rolls out to all 6 properties | Adds 10 more vehicles → refers another fleet operator | Expands from 1 zip code to full Atlanta metro |

#### Marketing Channel Summary by Persona

| Persona | Primary Channels | Secondary Channels | Estimated CAC |
|---|---|---|---|
| Stranded Driver | Google Search, Google Maps, post-service referral | Neighborhood Facebook groups, Nextdoor, apartment packets | $15-25 (referral) / $35-50 (paid search) |
| Used Car Buyer | Facebook Marketplace ads, Google Search | Instagram, car selling groups, Craigslist auto | $8-15 (targeted FB ads) |
| Rideshare Driver | Driver Facebook groups, airport staging flyers | TikTok/YouTube, campus boards, in-app referral | $5-10 (organic/community) |
| Used Car Seller | Facebook Marketplace content, Google Search | Instagram, car selling groups | $10-20 (content/SEO) |
| Dealership | Cold outreach, dealer association events | LinkedIn, dealer Facebook groups, referral | $200-500 (sales effort) |
| Apartment Complex | LinkedIn, property management events | Cold visits, referral from other managers | $150-300 (sales effort) |
| Fleet Operator | LinkedIn, cold outreach, Google Search | Logistics groups, Amazon DSP forums | $200-400 (sales effort) |
| Insurance Partner | Conferences, direct outreach | LinkedIn, case studies | $500-1,000 (enterprise sales) |
| Independent Tow Operator | Facebook groups, cold approach, referral bonus | Demo video, overflow partnerships | $50-100 (referral) / $0 (overflow partner) |
| Rideshare Side-Hustler | Driver Facebook groups, TikTok/YouTube | Campus boards, staging area flyers, in-app | $10-25 (content + kit sale covers CAC) |

## Success Metrics

### User Success Metrics

**B2C Consumer Success**

| Metric | What It Measures | Target | How We Know It's Working |
|---|---|---|---|
| Time-to-Help | Minutes from booking to provider arrival | < 20 min (core zones) | Customer isn't standing on I-285 for an hour |
| Booking Completion Rate | % of started bookings that complete | > 85% | Booking flow has no friction walls |
| First-Service Resolution | % of jobs completed without escalation | > 90% | Right provider, right skill, first time |
| Post-Service Referral Rate | % of customers who share referral link | > 25% | "That was good enough to tell someone about" |
| Repeat Customer Rate | % of customers who book 2+ services within 12 months | > 30% | Platform becomes their default, not a one-time rescue |
| Trust Tier Progression | % of new customers who complete 5 jobs and unlock card payment | > 15% within 12 months | Customers stick around beyond the first emergency |
| Diagnostic Report Satisfaction | % of inspection customers who rate report useful | > 90% | Report is worth the $250 — they'd buy it again |

**B2B Account Success**

| Metric | What It Measures | Target | How We Know It's Working |
|---|---|---|---|
| Contract Retention Rate | % of B2B accounts renewing after initial term | > 85% | Service is embedded in their operations |
| B2B Response Time | Minutes to dispatch for contract accounts | < 15 min | Priority dispatch actually means something |
| Dealership Inspection Volume | Inspections/month per dealership partner | > 8/month | Inspections are routine, not occasional |
| Apartment Resident Conversion | % of helped residents who become personal customers | > 40% | Every parking deck rescue creates a platform customer |
| Fleet Uptime Impact | % reduction in fleet vehicle downtime vs. pre-contract | > 50% | Fleet operators can quantify ROI to their bosses |

**Provider Success**

| Metric | What It Measures | Target | How We Know It's Working |
|---|---|---|---|
| Provider Monthly Earnings | Average monthly earnings from platform | > $800/month (heavy) / > $400/month (light) | Worth their time — not leaving for competitors |
| Provider Idle Time Reduction | Hours of productive work vs. idle time | > 60% utilization during active hours | Platform fills their downtime, not just adds to it |
| Provider Retention (90-day) | % of providers still active after 90 days | > 70% | They're staying because the economics work |
| Provider Rating Average | Mean provider rating across all jobs | > 4.5/5 | Quality bar is maintained as network scales |
| Job Acceptance Rate | % of dispatched jobs accepted by first provider | > 75% | Auto-dispatch is sending the right jobs to the right people |

---

### Business Objectives

#### Phase 1: Survive (Month 1-2)

| Objective | Target | Leading Indicator |
|---|---|---|
| B2B contracts signed | 3 minimum (2 dealerships + 1 apartment) | Outreach pipeline: 15+ conversations started |
| Monthly recurring B2B revenue | $6,000-10,000/month | First contract signed within 2 weeks |
| Active providers on platform | 5 minimum (2 heavy + 3 light) | Provider applications: 15+ received |
| Quick wins shipped | 6 features (Trust Tier, Time-Block Pricing, Tiered Commission, Scheduled Bookings, Referral Text, Vehicle Observation) | All 6 deployed and functional |
| Total bookings completed | 30+ | At least 5/week with confirmed payments |

#### Phase 2: Foundation (Month 2-4)

| Objective | Target | Leading Indicator |
|---|---|---|
| Consumer launch (ITP zone) | Live with real customers booking | First 10 organic B2C bookings |
| Monthly revenue (blended B2B + B2C) | $12,000-18,000/month | Week-over-week booking growth > 10% |
| Active providers | 15 (5 heavy + 10 light) | Rideshare driver conversion rate from Facebook group posts |
| RoadSide Pass subscribers | 25+ | Post-service subscription conversion > 5% |
| Facebook Marketplace diagnostic bookings | 10+/month | Ad CTR > 2%, booking conversion > 8% |
| Apartment complex contracts | 4 total | Property manager referral rate |

#### Phase 3: Growth (Month 4-8)

| Objective | Target | Leading Indicator |
|---|---|---|
| Monthly revenue | $25,000-40,000/month | B2B stable + B2C accelerating |
| Active providers | 30+ across all zones | Provider-refers-provider generating 3+/month |
| OTP zone expansion | 2+ OTP zones activated | Provider coverage density in target zones |
| Subscription revenue (all tiers) | $3,000+/month recurring | Subscription mix: Pass + Priority Plan + Health Plan |
| Average response time (ITP) | < 15 minutes | Provider pre-positioning working |
| Diagnostic bookings | 30+/month | SEO + FB Marketplace ads driving organic growth |

#### Phase 4: Dominance (Month 8-12)

| Objective | Target | Leading Indicator |
|---|---|---|
| Monthly revenue | $50,000-80,000/month | Blended: ~40% B2B + ~35% B2C emergency + ~25% diagnostics/subscriptions |
| Annual run rate | $400,000-600,000 gross | Consistent month-over-month trajectory |
| Net platform revenue | $100,000-150,000/year (at blended 25% take) | Unit economics positive across all service categories |
| Active providers | 50+ | Full Atlanta metro coverage with < 20 min response |
| Total customers served | 1,500+ unique customers | Organic/referral > 50% of new customers |
| Insurance partnership | 1 signed | Pilot program completed with positive NPS impact |
| Storm Mode activations | 2-3 events generating $5,000+ each | Pre-built playbook tested and revenue-verified |

---

### Key Performance Indicators

#### North Star Metric

**Bookings Completed Per Week** — The single number that captures demand (customers booking), supply (providers available), and execution (jobs completed successfully). Everything else ladders up to this.

| Phase | Target |
|---|---|
| Month 1-2 | 5-10/week |
| Month 2-4 | 15-30/week |
| Month 4-8 | 40-75/week |
| Month 8-12 | 100-150/week |

#### Daily Dashboard (Beel's Morning Check)

| KPI | What to Check | Alert Threshold |
|---|---|---|
| Bookings today/yesterday | Volume trend | < 50% of 7-day average |
| Payments pending confirmation | Manual payment backlog | > 5 unconfirmed > 24 hours |
| Provider availability | Providers currently online | < 3 online during business hours |
| Average response time (7-day) | Service quality trend | > 25 minutes |
| Revenue this week | Financial health | < 70% of prior week |
| Provider applications pending | Supply pipeline | > 3 pending > 48 hours |

#### Financial KPIs

| KPI | Formula | Target |
|---|---|---|
| Gross Revenue | Total booking value (all sources) | Track weekly |
| Platform Take Rate | Platform revenue / gross revenue | 25% blended (30% basic / 25% standard / 20% premium) |
| B2B Revenue % | B2B contract revenue / total revenue | > 40% in Phase 1-2, > 30% steady state |
| Customer Acquisition Cost | Marketing spend / new customers acquired | < $25 (B2C) / < $500 (B2B) |
| Customer Lifetime Value | Average revenue per customer over 12 months | > $200 (B2C) / > $3,000 (B2B) |
| LTV:CAC Ratio | Lifetime value / acquisition cost | > 5:1 (B2C) / > 6:1 (B2B) |
| Monthly Recurring Revenue (MRR) | Subscriptions + B2B contracts | Track growth rate monthly |
| Chargeback Rate | Disputed transactions / total card transactions | < 0.5% (Trust Tier should drive to near 0%) |
| Provider Payout Ratio | Provider payouts / gross revenue | 70-75% (healthy marketplace margin) |

#### Operational KPIs

| KPI | Target | Measurement |
|---|---|---|
| Average Response Time | < 20 min (ITP), < 30 min (OTP) | Booking confirmed → provider on-scene |
| Auto-Dispatch Success Rate | > 70% | First auto-dispatched provider accepts and completes |
| Booking-to-Completion Rate | > 85% | Booked → not cancelled → completed |
| Provider No-Show Rate | < 5% | Accepted jobs where provider fails to arrive |
| Payment Confirmation Lag | < 4 hours (manual methods) | Time from service completion to payment confirmed |
| Provider Onboarding Time | < 48 hours from application to first job | Application → approval → first job accepted |

#### Growth KPIs

| KPI | Target | Measurement |
|---|---|---|
| Organic/Referral % of New Customers | > 50% by Month 6 | New customers from referral links + organic search vs. paid |
| Provider Network Growth Rate | 4-6 new providers/month | Net new active providers (joins minus churns) |
| Zone Coverage Expansion | 1 new zone/quarter after ITP launch | Zones activated with < 20 min coverage guarantee |
| B2B Pipeline Conversion | > 25% of outreach → signed contract | Conversations started → contracts signed |
| Subscription Conversion Rate | > 8% of one-time customers | Customers who subscribe within 30 days of first service |
| Net Promoter Score (NPS) | > 60 | Post-service survey (text-based, 1 question) |

## MVP Scope

### Scope Context

RoadSide ATL is a brownfield project at ~85% production readiness. The MVP scope defines what must be **added, modified, or completed** to go live and generate revenue — not a ground-up build. The existing platform provides: booking flow, auto-dispatch, real-time GPS tracking, provider portal, admin dashboard, multi-payment support, reviews, email/SMS/push notifications, SEO infrastructure, and Docker deployment.

---

### Core Features

#### 1. Financial Module (Comprehensive — Top Priority)

**A. Trust Tier Payment System** *(NEW — Critical)*
- New customers restricted to non-reversible payment methods only (Cash, CashApp, Zelle)
- Admin-configurable threshold for card unlock (default: 5 completed jobs with no issues)
- Customer profile displays trust tier progress ("3/5 jobs completed — 2 more to unlock card payment")
- Admin override capability (manually promote/demote trust tier)
- Trust tier status persisted in user profile (new DB field)
- Booking flow enforces payment method restrictions based on trust tier
- Stripe checkout blocked for customers below threshold

**B. Tiered Commission by Service Category** *(NEW)*
- Commission rates configurable per service, not just per provider
- Default tiers: Basic services (jump start, lockout, fuel) = 30% platform / 70% provider. Standard services (flat tire, towing) = 25% platform / 75% provider. Premium services (diagnostics, long-distance tow) = 20% platform / 80% provider
- Admin UI to configure commission rate per service
- Payout calculator updated to use service-level commission when set, falling back to provider-level rate
- Commission displayed transparently to provider on job acceptance screen

**C. Time-Block Pricing** *(NEW)*
- Three pricing tiers by time of day: Standard (7AM-9PM, base price), After-Hours (9PM-1AM, +25%), Emergency (1AM-7AM, +50%)
- Multiplier applied automatically at booking time based on scheduled/requested time
- Provider sees same commission percentage on higher base — their earnings increase proportionally
- Admin configurable: time blocks, multiplier percentages, enable/disable per service
- Pricing tier clearly displayed to customer during booking ("After-Hours rate applies")
- Override capability for admin (manual price adjustment on specific bookings)

**D. B2B Invoicing & Contracts** *(NEW)*
- B2B account type for users (new role or flag: `account_type: 'b2b'`)
- Business profile: company name, billing address, billing contact, payment terms (Net 15/30)
- Contract management: monthly retainer amount, per-job rates, included services, contract start/end dates
- Monthly invoice generation: auto-generated at month-end, itemized by service, sent via email (PDF)
- Invoice status tracking: draft → sent → paid → overdue
- Admin dashboard: B2B accounts list, contract details, invoice history, outstanding balance
- B2B bookings tagged to business account for consolidated billing
- Priority dispatch flag for contract accounts

**E. Subscription Billing** *(NEW)*
- Three subscription tiers:
  - RoadSide Pass ($14.99/month): $0 dispatch fee, priority queue, 10% off all services
  - Rideshare Priority Plan ($39/month): guaranteed sub-20-min response, 1 free basic service/month
  - Vehicle Health Plan ($29/month): quarterly diagnostic scan, priority dispatch, 10% off all services
- Stripe subscription integration (recurring billing)
- Subscription status in user profile (active, cancelled, past_due)
- Benefit enforcement: discount applied at booking, priority flag in dispatch algorithm, free service tracking
- Admin: subscriber list, churn tracking, MRR dashboard
- Self-service: subscribe, upgrade/downgrade, cancel from customer dashboard

**F. Surge / Event Pricing** *(NEW)*
- Admin-toggled "Storm Mode" or "Event Mode" with configurable multiplier (+25% to +75%)
- Event pricing applied globally or per-service
- Start/end time for pricing events (auto-revert)
- Customer sees transparent pricing: "Event pricing active — demand is high"
- Provider sees peak pay bonus indicator on job notifications
- Admin dashboard: active pricing events, revenue impact tracking
- Pre-built templates: Ice Storm (+75%), Falcons Game (+25%), Holiday Weekend (+50%)

**G. Provider Volume Bonuses** *(NEW)*
- Tiered bonus structure: 20+ jobs/month = 5% less platform take, 40+ jobs/month = additional 3% reduction
- Calculated monthly, applied to next month's payouts
- Provider dashboard shows current tier, progress to next tier, projected bonus
- Admin configurable: tier thresholds and bonus percentages
- Resets monthly — providers must maintain volume to keep bonus

**H. Referral Credit System** *(NEW)*
- Post-service referral text: customer receives unique referral link 5 minutes after completion
- Referred friend gets $15 off first service
- Referrer gets $15 platform credit when friend completes first booking
- Credit balance tracked in user profile, applied automatically at next booking
- Provider-refers-provider: $100-200 bonus when referred provider completes 5 jobs
- Admin: referral tracking dashboard, credit balance management, fraud detection (same household, etc.)

**I. Pre-Paid Credit System** *(FUTURE — Phase 2)*
- Buy $200 credit at 10% discount ($180)
- Credit balance draws down per booking
- Eliminates disputes entirely for credit-funded transactions
- Breakage revenue on unredeemed credits
- *Deferred: requires regulatory review on stored value / gift card laws in Georgia*

**J. Financial Reporting Enhancements** *(MODIFY EXISTING)*
- Revenue analytics upgraded: breakdown by B2C vs. B2B, by service category, by payment method, by time-block tier
- Subscription MRR tracking with growth/churn visualization
- Provider earnings report: individual and aggregate, commission tier breakdown
- B2B account P&L: revenue per contract vs. cost of service delivery
- Chargeback/dispute tracking (for when card payments are enabled via Trust Tier)
- Tax reporting: 1099-ready provider earnings export (annual)
- Daily/weekly/monthly revenue email digest to admin

**K. Payment Flow Hardening** *(MODIFY EXISTING)*
- Payment confirmation workflow: admin confirms manual payment → triggers payout calculation → creates provider payout record → sends provider notification
- Batch payout processing: admin selects multiple pending payouts → mark all paid → audit log entry
- Payment receipt auto-generation and email to customer on confirmation
- Stripe webhook resilience: retry handling, idempotency, failed webhook alerting
- Refund workflow: admin-initiated partial/full refund → updates payment status → adjusts provider payout → audit log

---

#### 2. Platform Features (Already Built — Verify & Harden)

| Feature | Status | MVP Action |
|---|---|---|
| Multi-step booking form | Built | Integrate Trust Tier payment restrictions + time-block pricing display |
| Auto-dispatch by GPS | Built | Add priority dispatch flag for B2B/subscriber accounts |
| Real-time tracking (WebSocket) | Built | Verify production stability under concurrent connections |
| Provider portal (jobs, status, earnings) | Built | Add commission tier display, volume bonus progress, referral tracking |
| Admin dashboard (bookings, revenue, providers, payouts) | Built | Extend with B2B accounts, subscription management, financial reporting upgrades |
| Multi-payment (Stripe, Cash, CashApp, Zelle) | Built | Add Trust Tier enforcement, refund workflow |
| Provider onboarding (invite + self-registration) | Built | Verify email flow works in production |
| Email/SMS/push notifications | Built | Add referral text trigger, subscription confirmation, B2B invoice notification |
| Reviews and ratings | Built | No changes needed for MVP |
| SEO (structured data, sitemap, robots.txt) | Built | No changes needed for MVP |
| Auth (Google, credentials, email verification) | Built | No changes needed for MVP |
| Docker deployment | Built | Verify Coolify deployment pipeline |

---

#### 3. Quick Wins (Ship in First Sprint — ~5 Days)

| Priority | Feature | Effort | Dependency |
|---|---|---|---|
| 1 | Trust Tier Payment System | 1-2 days | Blocks going live with card payments |
| 2 | Time-Block Pricing | 0.5 day | Blocks after-hours revenue capture |
| 3 | Tiered Commission by Service | 0.5 day | Blocks fair provider compensation |
| 4 | Scheduled Bookings (non-emergency) | 1 day | Blocks diagnostic appointments |
| 5 | Post-Service Referral Text | 0.5 day | Blocks organic growth engine |
| 6 | Provider Vehicle Observation Checklist | 0.5 day | Blocks upsell pipeline |

---

#### 4. Diagnostics Pillar (MVP Foundation)

| Feature | Description | Priority |
|---|---|---|
| Diagnostic service booking | Booking flow supports scheduling inspections at specific location + time | MVP |
| Tiered diagnostic products | Basic ($250), Standard ($325), Premium ($400) selectable at booking | MVP |
| Branded inspection report (PDF) | Post-inspection report auto-generated with findings, emailed to customer | MVP |
| Seller-side certificate | Same inspection flow, marketed differently, generates "Seller Certified" badge for listing | Phase 2 |
| Dealership bulk booking portal | B2B interface for submitting multiple inspection requests | Phase 2 |

---

### Out of Scope for MVP

| Feature | Reason for Deferral | Target Phase |
|---|---|---|
| Pre-Paid Credit System | Georgia stored-value regulations need review | Phase 2 |
| Insurance company API integration | Requires enterprise sales cycle + API development | Phase 4 |
| Provider territory ownership system | Needs sufficient provider density to implement zones | Phase 3 |
| Provider leaderboard / gamification | Nice-to-have; not blocking revenue | Phase 3 |
| Destination Mode for providers | Requires route optimization logic | Phase 3 |
| Service stacking (multi-job routing) | Complex dispatch logic; needs volume to justify | Phase 3 |
| Roadside Warranty product ($199/year) | Requires actuarial analysis on claim frequency | Phase 3 |
| Dealer-funded free 6-month coverage | Needs dealership partner system built first (B2B invoicing) | Phase 2 |
| Claims-based pricing (renewal discounts) | Needs 12+ months of usage data | Phase 4 |
| Diagnostics data licensing | Zero marginal cost revenue but needs volume | Phase 4 |
| Mobile app (iOS/Android) | Web-first approach; responsive PWA sufficient for launch | Phase 3-4 |
| Multi-city expansion | Atlanta must be proven first | Phase 4+ |
| Automated Stripe dispute response | Trust Tier should prevent most disputes; handle manually initially | Phase 2 |
| Provider starter kit e-commerce | Sell kits offline/manually at first; automate later | Phase 2 |
| Storm Mode auto-activation (weather API) | Manual admin toggle is sufficient for MVP; 2-3 events/year | Phase 3 |

---

### MVP Success Criteria

**Go-Live Gate (Must be true before first real customer):**

- [ ] Trust Tier Payment System functional and enforcing payment restrictions
- [ ] Time-block pricing calculating correctly for all time windows
- [ ] Tiered commission calculating correct provider payouts per service category
- [ ] At least 3 active providers (1 heavy + 2 light) available during business hours
- [ ] Auto-dispatch successfully assigning providers in < 5 seconds
- [ ] Real-time tracking working end-to-end (booking → provider location → completion)
- [ ] Payment confirmation workflow operational for all 4 payment methods
- [ ] Admin can confirm payments, process payouts, and view revenue analytics
- [ ] Email + SMS notifications firing on booking, assignment, and completion
- [ ] Deployed to production (Coolify) with health check passing

**Month 1 Validation Gates:**

| Gate | Threshold | Decision |
|---|---|---|
| Bookings completed | 15+ in first 30 days | Continue → Phase 2 investment |
| Provider no-shows | < 10% | Provider quality is viable |
| Average response time | < 25 min | Dispatch model works |
| Payment collection rate | > 90% of completed jobs paid | Revenue model is viable |
| B2B contracts | 1+ signed | B2B channel has demand |
| Customer complaints | < 5% of bookings | Service quality acceptable |

**Scale Decision Point (Month 3):**

| Signal | Threshold | Action |
|---|---|---|
| Revenue > $8K/month | Achieved | Invest in Phase 2 features |
| Provider retention > 60% | Achieved | Provider economics work — recruit more |
| Organic bookings > 30% | Achieved | Reduce paid acquisition spend |
| Revenue < $3K/month | Not achieved | Pivot strategy or marketing approach |
| Provider churn > 50% | Not achieved | Rework provider compensation model |

---

### Future Vision

**Phase 2 (Month 2-4): Foundation**
- Subscription billing (RoadSide Pass, Priority Plan, Vehicle Health Plan)
- B2B invoicing and contract management
- Surge/event pricing with Storm Mode
- Provider volume bonuses
- Referral credit system
- Seller-side diagnostic certificates
- Dealer-funded buyer coverage program
- Branded inspection PDF reports

**Phase 3 (Month 4-8): Growth**
- Provider territory ownership
- Service stacking (multi-job dispatch)
- Provider leaderboard and gamification
- Destination mode for providers
- Roadside Warranty product ($199/year)
- Zone-based geographic expansion (OTP)
- Pre-paid credit system
- Storm Mode auto-activation via weather API

**Phase 4 (Month 8-12): Dominance**
- Insurance company dispatch partnerships
- Claims-based renewal pricing
- Diagnostics data licensing
- Mobile app (iOS/Android)
- Multi-city expansion playbook
- Automated Stripe dispute response
- Fleet management self-service portal
- Provider training and certification platform

**Year 2+: National Scale**
- City-by-city expansion across Southeast (Charlotte, Nashville, Jacksonville, Birmingham)
- National insurance partnerships
- Franchise/license model for local operators
- Vehicle health data marketplace
- Integration with OBD2 device ecosystem (real-time vehicle health monitoring)
- AI-powered predictive dispatch (pre-position providers before demand spikes)
