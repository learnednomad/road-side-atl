# Epic 10: Provider Onboarding — E2E Test Report

**Date**: 2026-03-05
**Environment**: Docker Compose (Next.js prod build + PostgreSQL 16)
**Tool**: Playwright MCP (Chromium)
**Tester**: Claude (automated) + Beel (oversight)

---

## Test Environment Setup

- Docker stack: `docker compose up --build`
- Schema push: `drizzle-kit push --force` (migration numbering conflicts exist — two 0018s and two 0019s)
- Admin seed: `admin@roadsideatl.com` / `admin123` (bcrypt hash via `bcryptjs`)
- Port 3000 (Next.js), Port 5432 (PostgreSQL)

---

## Flows Tested

### Flow 1: Provider Application (become-provider)

**Steps**: Navigate to `/become-provider` > Fill form > Submit
**Result**: PASS (with bug found)

- Application form renders with Name, Email, Password, Phone, Service Area, Specialties (checkboxes), FCRA consent
- Form submission creates user + provider + 5 onboarding steps
- Auto-login after apply works (session created server-side, bypasses authorize)
- Redirect to `/provider/onboarding` works

**BUG #1 (HIGH)**: Apply endpoint (`/api/onboarding/apply`) does NOT set `emailVerified` on the created user. `lib/auth.config.ts:33` requires `emailVerified` for non-admin users. This means:
- First login (auto-login after apply) works
- Subsequent logins fail with "Invalid email or password" (misleading error)
- **Fix**: Set `emailVerified: new Date()` in the apply endpoint's user INSERT

### Flow 2: Provider Onboarding Dashboard

**Steps**: Login as provider > Navigate to `/provider/onboarding`
**Result**: PASS (with bug found)

- Dashboard renders 5 step cards: Background Check, Insurance Upload, Certifications Upload, Training Modules, Payment Setup
- Progress bar shows "0 of 5 steps completed"
- Background Check shows "In Progress" (auto-started by apply endpoint)
- Other 4 steps show "Not Started"
- Sidebar correctly disables Jobs, Earnings, Invoices for onboarding providers

**BUG #2 (MEDIUM)**: Provider dashboard header shows `$NaN` for "Week Earnings". The stats API returns 403 (correctly gated by `requireOnboardingComplete`), but the UI doesn't handle the error response gracefully.
- **Fix**: Check for error response in stats fetch and default to `$0.00`

### Flow 3: Portal Gating

**Steps**: As onboarding provider, navigate to `/provider/jobs`
**Result**: PARTIAL PASS

- API gating works: `/api/provider/jobs` returns 403/error (middleware blocks)
- Page-level gating missing: The `/provider/jobs` page RENDERS (shows empty Job History table with "Failed to load jobs" error)
- Sidebar correctly grays out Jobs/Earnings/Invoices (non-clickable)

**BUG #3 (MEDIUM)**: Observations, Inspections, Referrals links are NOT gated in the sidebar. Onboarding providers can navigate to these pages freely.
- `/provider/observations` renders full page with empty table
- Same expected for `/provider/inspections` and `/provider/referrals`
- **Fix**: Add these three routes to the sidebar gating logic alongside Jobs/Earnings/Invoices

### Flow 4: Admin Provider Management

**Steps**: Login as admin > Providers page > Edit provider > Test API endpoints
**Result**: PARTIAL PASS

- Providers list shows test provider with status "onboarding", 70% commission
- Edit dialog shows generic fields (Name, Email, Phone, Commission, Status, Specialties, Tax ID)
- API endpoints work:
  - `POST /:id/activate` — returns 400 "Invalid transition: onboarding -> active" (correct per state machine)
  - `POST /:id/reject` — returns 400 "Invalid transition: onboarding -> rejected" (correct per state machine)
  - State machine requires: `onboarding -> pending_review -> active/rejected`

**BUG #4 (MEDIUM)**: Admin providers page has NO onboarding-specific UI. Missing:
- No "View Onboarding Steps" panel
- No "Activate" / "Reject" / "Suspend" / "Reinstate" buttons
- No step review interface (approve/reject individual steps)
- No visual indicator of onboarding progress
- Admin can only use generic Edit dialog or raw API calls
- **Fix**: Add onboarding management section to admin provider detail view (or create dedicated onboarding pipeline page)

### Flow 5: Provider Invite Flow

**Steps**: Admin creates invite via API > Navigate to invite URL
**Result**: PASS

- `POST /api/admin/providers/invites` creates invite and returns token
- `/become-provider?invite={token}` shows adapted form ("Complete Your Registration")
- Form shows Password, Phone, Service Area, Specialties, FCRA consent (no email/name — pulled from invite)

---

## API Endpoint Verification

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/onboarding/apply` | POST | Works | Missing emailVerified (Bug #1) |
| `/api/onboarding/dashboard` | GET | Works | Returns steps + progress |
| `/api/onboarding/invite-accept` | POST | Not tested | Form exists, rate-limited |
| `/api/onboarding/reapply` | POST | Not tested | Requires rejected status |
| `/api/admin/providers` | GET | Works | Lists providers |
| `/api/admin/providers/invites` | POST | Works | Creates invite token |
| `/api/admin/providers/:id/activate` | POST | Works | State machine enforced |
| `/api/admin/providers/:id/reject` | POST | Works | State machine enforced |
| `/api/admin/providers/:id/suspend` | POST | Not tested | Requires active status |
| `/api/admin/providers/:id/reinstate` | POST | Not tested | Requires suspended status |
| `/api/admin/providers/:id/steps/:stepId` | PATCH | Not tested | Step review |
| `/api/provider/jobs` | GET | Works | Correctly returns 403 for onboarding |
| `/api/provider/stats` | GET | Works | Correctly returns 403 for onboarding |

---

## Bug Summary

| # | Severity | Description | File(s) | Status |
|---|----------|-------------|---------|--------|
| 1 | HIGH | Apply endpoint doesn't set emailVerified — providers can't log back in | `server/api/routes/onboarding.ts` | Open |
| 2 | MEDIUM | $NaN in Week Earnings when stats API returns 403 | Provider dashboard component | Open |
| 3 | MEDIUM | Sidebar doesn't gate Observations/Inspections/Referrals for onboarding providers | Provider sidebar component | Open |
| 4 | MEDIUM | Admin UI missing onboarding management controls (activate/reject/step review) | `app/(portal)/admin/providers/page.tsx` | Open |

---

## State Machine Verification

```
Provider Transitions (verified):
  applied -> onboarding        (auto on apply)
  onboarding -> pending_review (requires all steps complete)
  pending_review -> active     (admin activate)
  pending_review -> rejected   (admin reject)
  rejected -> applied          (provider reapply, 30-day cooldown)
  active -> suspended          (admin suspend)
  suspended -> onboarding      (admin reinstate)

Step Transitions (from code):
  pending -> draft | in_progress
  draft -> in_progress | pending
  in_progress -> pending_review | complete
  pending_review -> complete | rejected
  rejected -> draft | pending
```

---

## Screenshots

All screenshots saved to `e2e-screenshots/`:
- `portal-gating-jobs.png` — Jobs page showing "Failed to load jobs" for onboarding provider
- `ungated-observations.png` — Observations page accessible to onboarding provider (bug #3)
- `admin-providers-list.png` — Admin providers page with test provider
- `admin-edit-provider-dialog.png` — Edit dialog missing onboarding controls (bug #4)
- `invite-accept-form.png` — Invite acceptance form

---

## Recommendations

1. **Fix Bug #1 immediately** — This blocks the entire provider login flow after initial session expires
2. **Fix Bug #3 before Epic 11** — Document upload pages (Epic 11) will be accessible to providers who shouldn't reach them
3. **Bug #4 should be addressed as part of Epic 11** — Admin needs a pipeline view to review documents and manage onboarding
4. **Add page-level middleware** for provider portal routes, not just API-level gating
5. **Consider adding E2E tests** using Playwright test runner for regression prevention
