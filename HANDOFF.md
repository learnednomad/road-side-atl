# RoadSide GA — Project Handoff

_Last updated: 2026-06-12 (evening) • Production: **v1.9.0** live at roadsidega.com • Branch: `development`_

Single source of truth for cross-session state: what's shipped, what's in flight, required operator actions, and the near-term roadmap. History lives in git/PRs; this doc is the current picture.

---

## 1. Production state

- **v1.9.0** (2026-06-12, deployed + verified live): customer web UIs for memberships (`/account/membership` — also fixes the post-Stripe-checkout 404 at the success_url), loyalty (`/account/loyalty` + redeem on pending bookings), and post-inspection quote approval on the tracking page (#107). Note: the v1.9.0 Deploy run shows **red but the deploy succeeded** — a status-parsing bug in the new wait step (fixed in #109, below).
- **v1.8.0** (2026-06-12, deployed + verified live): full Titan-style editorial redesign — hero with engraved illustration (`public/images/hero-engraving.png`), scenario cards, editorial services/pricing/trust/FAQ sections, ink footer, interior pages (`/services`, `/about`, `/book`, `/my-bookings`). GitHub Actions bumped to Node-24-runtime majors (checkout v6, setup-node v6, upload-artifact v7, aws-creds v6). No new migrations.
- **v1.7.0**: Stripe Identity customer verification (migration `0018`, gated behind `CUSTOMER_IDENTITY_VERIFICATION`, default OFF), location-aware zone+weather pricing (gated `ZONE_PRICING`/`WEATHER_PRICING`, default OFF), staging deploys for `-rc.*` tags.
- **Security remediation (June audit): complete.** All 24 headless-audit findings resolved (#82, #83) plus the original 30-finding remediation batches; shipped across v1.5.x–v1.6.x. Detail: `docs/audit-2026-06.md`, PRs #41–#83. Migration history is reconciled (baseline + `DB_ADOPT_BASELINE` cutover, `docs/prod-cutover-runbook.md`).

### Design system (apply to any new marketing surface)
Cream `#faf9f6` canvas, ink `neutral-950`, hairline dividers, Geist Mono for prices/stats/kickers, pill CTAs. **Red is a signal, not atmosphere** (~90% cream+ink / 8% black / 2% red: emergency card, BOOK pills, section ticks, logo). Shared header: `components/marketing/section-heading.tsx`. SEO guardrail: never change h1/h2 copy, FAQ content, JSON-LD, anchor ids, or sr-only text when restyling.

---

## 2. On `development`, awaiting next release

- **#109 — deploy wait-step status parse fix**: #105 (ships in v1.9.0's tag) polls the Coolify deployment, but its first-match grep read the *application* status (`running:healthy`) instead of the deployment status, so the v1.9.0 deploy run timed out red despite succeeding. #109 constrains the match to deployment lifecycle statuses. **Activates on the next tag.**

## 2a. OPEN PRs awaiting visual approval → merge

- **#110 — provider registration redesign** (`/register/provider`): two-column editorial application page (sticky pitch panel + numbered form sections, ink chips, red pill submit). CI green; Playwright-verified at 1680/390px + chip interaction.
- **#111 — provider portal redesign**: ink sidebar with white active pill, cream canvas, tracking-tight headers (12 files), mono stat numerals. CI green; verified logged in as demo provider. Styling only.

## 2b. Bugs found during the provider-portal tour (NOT yet fixed)

1. **Earnings “Earnings by Service” panel renders empty** on `/provider/earnings` despite payouts across 4 service types (`components/provider/earnings-charts.tsx` — likely the by-service aggregation or chart wiring).
2. **“Today” counts disagree**: dashboard says “Jobs Today: 0” while earnings says “Today: $304.50 · 4 jobs” for the same seeded data — inconsistent date/status bucketing between `provider-dashboard.tsx` stats and the earnings summary (suspect TZ or status filter).

## 2c. Local dev environment (recipe discovered 2026-06-12)

- DB: docker compose `db` service; **untracked `docker-compose.override.yml`** publishes it at `127.0.0.1:5433` to match `.env`'s `DATABASE_URL`. Schema was stale → `npx drizzle-kit push --force`, then `ADMIN_PASSWORD='<any ≥12 chars>' npm run db:seed` (seeded 6/12 with demo data).
- **`.env` is production-shaped** (`APP_ENV=production`, prod `AUTH_URL`, placeholder Stripe webhook secret). Booting `npm run start` against raw `.env` either fail-closes (placeholder guard) or **redirects auth to roadsidega.com — do not submit forms there**. Working boot: spawn with `.env`'s `DATABASE_URL` + `AUTH_URL=http://localhost:3000` + `APP_ENV=development` overridden in process env.
- Demo logins: provider `marcus@roadsidega.com` / `provider123`; customers `<seed emails>` / `customer123`; admin password is whatever `ADMIN_PASSWORD` was at seed time.

---

## 3. Mobile app (`learnednomad/roadside-atl-mobile`)

- **Parity: fully caught up** with web's customer-facing surface (PRs #5–#8): B2B portal, customer identity gate, location-aware pricing estimates (passes geocoded coords; renders zone/weather breakdown lines), memberships, loyalty (screen + redeem-on-booking), service bundles in the book flow, post-inspection quote approve/decline. Intentionally web-only: admin/B2B desktop tooling.
- ~~Mobile leads web on memberships/loyalty/quote approval~~ — **closed** (#107): web UIs shipped at `/account/membership`, `/account/loyalty`, redeem CTA in My Bookings, quote approval on the tracking page. Parity is now symmetric.
- **CI**: PRs #9/#10 — lint/typecheck/jest on every PR (zero-error baseline: was 578 lint errors, 2 broken test suites; root causes included a pnpm-incompatible jest `transformIgnorePatterns` and a real `ProgressBar` prop bug). Actions on v6.
- **No deploy workflow** — releases are manual EAS builds (`build:production:*` scripts / `app-release`). A tag-triggered `eas build --wait` workflow was considered and deliberately **not** added: needs `EXPO_TOKEN` secret + consumes EAS build credits per tag. Owner decision pending.
- Local tree has untracked WIP: `src/features/auth/use-social-login.ts` + `social-login-buttons.tsx` (cause 2 local-only tsc errors; not in CI). 7 legacy screens carry `max-lines-per-function` disables marked refactor-pending.

---

## 4. Operator actions (owner-only, no code)

1. **Stripe live-mode flip** (pre-launch, unchanged): recreate webhook in Live mode, rotate `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` together, disable sandbox webhook.
2. **meigen credits exhausted** (API can't use daily free credits) — blocks regenerating brand engravings via MCP; web UI with daily credits still works (that's how the current hero asset was made).
3. Verify the June-audit ops list was completed in Coolify (cred rotations, `TRUST_PROXY`, Maps key split, backup restore test) — see `docs/audit-2026-06.md` §ops if unsure.

---

## 5. Near-term roadmap

1. **Merge #110/#111 after visual sign-off**, then fix the two provider-portal bugs (§2b).
2. **Design-system leftovers**: `/track/[id]` (untested visually; needs a live booking), `/my-invoices`, `CostExpectations` accordion on `/services` still old-style.
3. **Feature-flag rollouts** when ready: `ZONE_PRICING`, `WEATHER_PRICING` (needs pricing_zones rows + OpenWeatherMap key), `CUSTOMER_IDENTITY_VERIFICATION` ($500+ checkout gate).
4. **Mobile EAS deploy workflow** — pending owner decision (§3).
5. Mobile legacy-screen refactors (max-lines disables) + finishing social-login WIP.

---

## 6. Conventions quick-reference

- Branch flow: feature → `development` → `main` (enforced). Squash-merge PRs to `development`; merge-commit `development → main` release PRs.
- Tag-then-deploy, annotated tags on the main merge commit: `v*.*.*` → production, `v*.*.*-rc.*` → staging. Coolify builds async (~5–10 min) — until #105 ships in a tag, don't trust the deploy-green checkmark alone; verify the new content is serving.
- Pre-deploy checklist: `npm test` (492), `npm run build`, eslint 0 errors, `tsc --noEmit`, clean tree.
- Mobile parity policy: every customer-facing web feature ships with a mobile counterpart (symmetric as of #107).
