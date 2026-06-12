# RoadSide GA — Project Handoff

_Last updated: 2026-06-12 • Production: **v1.8.0** live at roadsidega.com • Branch: `development`_

Single source of truth for cross-session state: what's shipped, what's in flight, required operator actions, and the near-term roadmap. History lives in git/PRs; this doc is the current picture.

---

## 1. Production state

- **v1.8.0** (2026-06-12, deployed + verified live): full Titan-style editorial redesign — hero with engraved illustration (`public/images/hero-engraving.png`), scenario cards, editorial services/pricing/trust/FAQ sections, ink footer, interior pages (`/services`, `/about`, `/book`, `/my-bookings`). GitHub Actions bumped to Node-24-runtime majors (checkout v6, setup-node v6, upload-artifact v7, aws-creds v6). No new migrations.
- **v1.7.0**: Stripe Identity customer verification (migration `0018`, gated behind `CUSTOMER_IDENTITY_VERIFICATION`, default OFF), location-aware zone+weather pricing (gated `ZONE_PRICING`/`WEATHER_PRICING`, default OFF), staging deploys for `-rc.*` tags.
- **Security remediation (June audit): complete.** All 24 headless-audit findings resolved (#82, #83) plus the original 30-finding remediation batches; shipped across v1.5.x–v1.6.x. Detail: `docs/audit-2026-06.md`, PRs #41–#83. Migration history is reconciled (baseline + `DB_ADOPT_BASELINE` cutover, `docs/prod-cutover-runbook.md`).

### Design system (apply to any new marketing surface)
Cream `#faf9f6` canvas, ink `neutral-950`, hairline dividers, Geist Mono for prices/stats/kickers, pill CTAs. **Red is a signal, not atmosphere** (~90% cream+ink / 8% black / 2% red: emergency card, BOOK pills, section ticks, logo). Shared header: `components/marketing/section-heading.tsx`. SEO guardrail: never change h1/h2 copy, FAQ content, JSON-LD, anchor ids, or sr-only text when restyling.

---

## 2. On `development`, awaiting next release

- **#105 — deploy health-check fix**: deploy jobs now poll the actual Coolify deployment (`deployment_uuid` → `/api/v1/deployments/{uuid}`) until `finished`, hard-failing on `failed`/`cancelled`, before the HTTP health check. **Activates on the next tag** (Deploy runs the workflow file at the tagged commit). Background: v1.8.0's health check passed ~7 min before the new build was actually serving.

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

1. **Design-system leftovers**: `/track/[id]` (untested visually; needs a live booking), `/my-invoices`, `CostExpectations` accordion on `/services` still old-style.
2. **Feature-flag rollouts** when ready: `ZONE_PRICING`, `WEATHER_PRICING` (needs pricing_zones rows + OpenWeatherMap key), `CUSTOMER_IDENTITY_VERIFICATION` ($500+ checkout gate).
3. **Mobile EAS deploy workflow** — pending owner decision (§3).
4. Mobile legacy-screen refactors (max-lines disables) + finishing social-login WIP.

---

## 6. Conventions quick-reference

- Branch flow: feature → `development` → `main` (enforced). Squash-merge PRs to `development`; merge-commit `development → main` release PRs.
- Tag-then-deploy, annotated tags on the main merge commit: `v*.*.*` → production, `v*.*.*-rc.*` → staging. Coolify builds async (~5–10 min) — until #105 ships in a tag, don't trust the deploy-green checkmark alone; verify the new content is serving.
- Pre-deploy checklist: `npm test` (492), `npm run build`, eslint 0 errors, `tsc --noEmit`, clean tree.
- Mobile parity policy: every customer-facing web feature ships with a mobile counterpart (symmetric as of #107).
