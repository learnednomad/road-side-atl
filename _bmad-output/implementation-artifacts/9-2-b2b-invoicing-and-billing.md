# Story 9.2: B2B Invoicing & Billing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want the system to generate monthly invoices for B2B accounts and track payment status,
so that B2B billing is automated and I can follow up on overdue payments.

## Acceptance Criteria

1. **Given** a B2B account has completed bookings during the billing period **When** I trigger monthly invoice generation for that account **Then** an itemized invoice is created listing each completed booking with service type, date, and amount **And** the invoice `tenantId` is set to the B2B account's ID **And** the `dueDate` is calculated from the account's payment terms (net_30 = +30 days, net_60 = +60 days, prepaid = now) **And** the invoice status is set to "draft" **And** an audit entry is logged with action `b2b_account.generate_invoice`

2. **Given** I review a draft B2B invoice **When** I send it to the B2B account **Then** the invoice status updates to "issued" **And** `issuedAt` is set to now **And** an email notification is sent to the B2B billing contact (`b2bAccounts.contactEmail`) with itemized invoice details **And** the email includes an unsubscribe link (NFR50 CAN-SPAM) **And** an audit entry is logged with action `invoice.send`

3. **Given** a B2B account pays their invoice **When** I mark the invoice as paid **Then** the status updates to "paid" **And** `paidAt` is set to now **And** an audit entry is logged with action `invoice.mark_paid`

4. **Given** an invoice is past its payment terms **When** I mark the invoice as overdue **Then** the status updates to "overdue" **And** the B2B accounts list and invoice list visually highlight overdue invoices for follow-up **And** an audit entry is logged with action `invoice.mark_overdue`

5. **Given** I am viewing a B2B account detail **When** I look at the invoices section **Then** I see all invoices for that account with status, total amount, due date, billing period, and action buttons for generate, send, mark paid, and mark overdue

6. **Given** a non-admin user **When** they attempt to access B2B invoice generation or send endpoints **Then** they receive a 403 Forbidden response (existing `requireAdmin` middleware)

## Tasks / Subtasks

- [x] Task 1: Extend invoices schema for B2B billing (AC: 1, 3, 4)
  - [x] 1.1 Add `"overdue"` to `invoiceStatusEnum` in `db/schema/invoices.ts`
  - [x] 1.2 Add `dueDate` timestamp column to `invoices` table (nullable — only set for B2B invoices)
  - [x] 1.3 Add `billingPeriodStart` text column (nullable — ISO date string, only for B2B)
  - [x] 1.4 Add `billingPeriodEnd` text column (nullable — ISO date string, only for B2B)
  - [x] 1.5 Run `npm run db:generate` to create migration
  - [x] 1.6 Run `npm run db:push` to apply in dev
- [x] Task 2: Add B2B invoice validators and constants (AC: 1, 2, 3, 4)
  - [x] 2.1 Add `generateB2bInvoiceSchema` (billingPeriodStart, billingPeriodEnd as required strings) to `lib/validators.ts`
  - [x] 2.2 Extend `updateInvoiceStatusSchema` to allow `"paid"` and `"overdue"` transitions in `lib/validators.ts`
  - [x] 2.3 Add `B2B_INVOICE_DUE_DAYS` map to `lib/constants.ts`: `{ prepaid: 0, net_30: 30, net_60: 60 }`
- [x] Task 3: Add B2B invoice audit actions (AC: 1, 2, 3, 4)
  - [x] 3.1 Add `b2b_account.generate_invoice`, `invoice.send`, `invoice.mark_paid`, `invoice.mark_overdue` to `AuditAction` type union in `server/api/lib/audit-logger.ts`
- [x] Task 4: Create B2B monthly invoice generator function (AC: 1)
  - [x] 4.1 Add `createB2bMonthlyInvoice(accountId, billingPeriodStart, billingPeriodEnd)` to `server/api/lib/invoice-generator.ts`
  - [x] 4.2 Query completed bookings where `tenantId = accountId` AND `updatedAt` (completion date) falls within billing period
  - [x] 4.3 Exclude bookings that already have an invoice (check `invoices.bookingId`)
  - [x] 4.4 Build line items: one per booking with service name, booking date, and finalPrice (or estimatedPrice fallback)
  - [x] 4.5 Look up B2B account for contactName/contactEmail/contactPhone and paymentTerms
  - [x] 4.6 Calculate `dueDate` = now + B2B_INVOICE_DUE_DAYS[paymentTerms]
  - [x] 4.7 Create invoice with `tenantId = accountId`, `status = "draft"`, `billingPeriodStart`, `billingPeriodEnd`, `dueDate`
- [x] Task 5: Add B2B invoice endpoints to b2b-accounts route (AC: 1, 5, 6)
  - [x] 5.1 Add `GET /:id/invoices` to `server/api/routes/b2b-accounts.ts` — list invoices where `tenantId = accountId`, ordered by `createdAt desc`
  - [x] 5.2 Add `POST /:id/invoices` to `server/api/routes/b2b-accounts.ts` — generate B2B monthly invoice, validates billing period, calls `createB2bMonthlyInvoice()`
- [x] Task 6: Extend admin-invoices route for send and status transitions (AC: 2, 3, 4)
  - [x] 6.1 Extend `PATCH /:id/status` handler in `server/api/routes/admin-invoices.ts` to handle `"paid"` (set `paidAt: new Date()`) and `"overdue"` transitions
  - [x] 6.2 Add `POST /:id/send` to `server/api/routes/admin-invoices.ts` — sends invoice email to B2B billing contact, sets status to "issued" and `issuedAt`, requires invoice to be in "draft" status and have a tenantId
- [x] Task 7: Add B2B invoice email notification (AC: 2)
  - [x] 7.1 Add `sendB2bInvoiceEmail()` to `lib/notifications/email.ts` — itemized HTML email with invoice details, amounts, due date, and unsubscribe link
  - [x] 7.2 Add `notifyB2bInvoiceSent()` orchestrator to `lib/notifications/index.ts` — calls email only (no SMS for invoices)
- [x] Task 8: Update B2B accounts UI for invoice management (AC: 5)
  - [x] 8.1 Add "Invoices" dialog/section to B2B account detail view in `components/admin/b2b-accounts-table.tsx`
  - [x] 8.2 Add "Generate Invoice" button with billing period date pickers (start/end date inputs)
  - [x] 8.3 Add invoice list within B2B detail showing: invoice number, billing period, total, status badge, due date
  - [x] 8.4 Add action buttons: "Send" (draft→issued+email), "Mark Paid" (issued/overdue→paid), "Mark Overdue" (issued→overdue)
  - [x] 8.5 Status badges with color coding: draft=gray, issued=blue, paid=green, overdue=red, void=muted

## Dev Notes

### Technical Requirements

**Schema Extension — `invoices` table modifications:**

```
dueDate: timestamp (nullable) — only set for B2B invoices, calculated from account paymentTerms
billingPeriodStart: text (nullable) — ISO date string (e.g., "2026-01-01"), only for B2B
billingPeriodEnd: text (nullable) — ISO date string (e.g., "2026-01-31"), only for B2B
```

**Enum Extension — `invoiceStatusEnum`:**
```
Current: ["draft", "issued", "paid", "void"]
Add: "overdue"
Result: ["draft", "issued", "paid", "void", "overdue"]
```

**Critical: The `invoices.tenantId` column already exists** (line 40 of `db/schema/invoices.ts`). B2B invoices set `tenantId = b2bAccount.id`. This links invoices to B2B accounts without a foreign key — consistent with the application-level filtering pattern used across the codebase.

**B2B invoice generation logic:**
1. Query `bookings` where `tenantId = accountId` AND `status = 'completed'` AND completion date within billing period
2. Exclude bookings that already have invoices (LEFT JOIN `invoices` ON `invoices.bookingId = bookings.id` WHERE `invoices.id IS NULL`)
3. Join with `services` to get service name for line items
4. Line item per booking: `{ description: "{serviceName} — {bookingDate}", quantity: 1, unitPrice: finalPrice || estimatedPrice, total: finalPrice || estimatedPrice }`
5. Use `generateInvoiceNumber()` (existing sequential function in invoice-generator.ts)
6. Set `dueDate` = now + payment terms days
7. Return empty array / error if no uninvoiced bookings in period

**Due date calculation:**
```typescript
const dueDays = B2B_INVOICE_DUE_DAYS[account.paymentTerms]; // { prepaid: 0, net_30: 30, net_60: 60 }
const dueDate = new Date();
dueDate.setDate(dueDate.getDate() + dueDays);
```

**Invoice status transitions (B2B flow):**
```
draft → issued (via POST /:id/send — sends email + sets issuedAt)
draft → void (via PATCH /:id/status)
issued → paid (via PATCH /:id/status — sets paidAt)
issued → overdue (via PATCH /:id/status)
overdue → paid (via PATCH /:id/status — sets paidAt, late payment received)
```

**Email template requirements (NFR50 CAN-SPAM compliance):**
- Subject: "Invoice {invoiceNumber} from RoadSide ATL"
- Body: Company name, billing period, itemized line items table, total amount, due date, payment instructions
- Footer: Physical address, unsubscribe link (`{NEXT_PUBLIC_APP_URL}/unsubscribe`)

### Architecture Compliance

**Mandatory patterns from architecture doc and project-context.md (127 rules):**

| Rule | How to comply |
|------|---------------|
| All API routes through Hono, NOT `app/api/` | Extend `server/api/routes/b2b-accounts.ts` and `server/api/routes/admin-invoices.ts` |
| `requireAdmin` on all admin endpoints | Already applied via `app.use("/*", requireAdmin)` on both routes |
| Zod v4 import path | `import { z } from "zod/v4"` — NEVER `from "zod"` |
| Money always integers in cents | Invoice `total`, `subtotal`, line item `unitPrice`, `total` — all cents |
| Manual `updatedAt` in every `.update().set()` | Invoices table does NOT have `updatedAt` — no action needed (only `createdAt`) |
| Destructure `.returning()` | `const [invoice] = await db.insert(invoices).returning()` |
| `logAudit()` for every state change | Generate, send, mark paid, mark overdue — all audited |
| No try-catch in route handlers | Hono handles uncaught errors |
| `safeParse` + 400 with `{ error, details }` | All Zod validation follows this pattern |
| Fire-and-forget notifications | `notifyB2bInvoiceSent(...).catch(() => {})` |
| Named exports for components | Component updates in existing `b2b-accounts-table.tsx` |
| Nullable timestamps for "did this happen" | `issuedAt`, `paidAt`, `dueDate` — use timestamp, NOT boolean |
| Use `eq()` for equality, `isNull()` for null checks | `isNull(invoices.bookingId)` for standalone check |
| `getRequestInfo(c.req.raw)` for audit IP/UA | Every audit log call includes IP and user agent |

**Key existing patterns to follow:**
- `createInvoiceForBooking()` in `server/api/lib/invoice-generator.ts` — follow the same insert pattern for B2B invoices
- `generateInvoiceNumber()` — reuse for B2B invoices (same sequence, same format)
- `admin-invoices.ts` PATCH /:id/status pattern — extend with new status values and corresponding field updates
- Invoice HTML generation via `generateInvoiceHTML()` — B2B invoices can reuse same HTML template

### Library & Framework Requirements

**No new dependencies required.** This story uses the existing stack entirely:

| Library | Version | Usage in this story |
|---------|---------|---------------------|
| Hono | ^4.11.7 | Extend existing route modules |
| Drizzle ORM | ^0.45.1 | Schema extension, queries |
| Zod | ^4.3.6 | Input validation (`import { z } from "zod/v4"`) |
| React | 19.2.3 | Update existing client component |
| shadcn/ui | (CLI) | Badge (status colors), Button, Dialog, Input (date pickers) |
| Resend | ^6.9.1 | Email invoice to B2B billing contact |
| lucide-react | (installed) | FileText, Send, Check, AlertTriangle icons for invoice actions |
| sonner | (installed) | `toast.success()` / `toast.error()` for UI feedback |
| date-fns | v4 | Format invoice dates, calculate due dates |

**Critical version traps:**
- Zod v4: `import { z } from "zod/v4"` — NOT `from "zod"`
- date-fns v4: use `format()`, `addDays()`, `parseISO()` from root import `from "date-fns"`
- Drizzle enum extension: adding values to `pgEnum` generates `ALTER TYPE ... ADD VALUE` migration — this is safe and non-breaking

### File Structure Requirements

**New files (0):** None — all changes extend existing files.

**Modified files (8):**

```
db/schema/invoices.ts                               ← MODIFY: add "overdue" to enum, add dueDate + billingPeriod columns
lib/constants.ts                                    ← MODIFY: add B2B_INVOICE_DUE_DAYS map
lib/validators.ts                                   ← MODIFY: add generateB2bInvoiceSchema, extend updateInvoiceStatusSchema
server/api/lib/audit-logger.ts                      ← MODIFY: add 4 new AuditAction types
server/api/lib/invoice-generator.ts                 ← MODIFY: add createB2bMonthlyInvoice() function
server/api/routes/b2b-accounts.ts                   ← MODIFY: add GET /:id/invoices, POST /:id/invoices
server/api/routes/admin-invoices.ts                 ← MODIFY: extend PATCH /:id/status, add POST /:id/send
lib/notifications/email.ts                          ← MODIFY: add sendB2bInvoiceEmail()
lib/notifications/index.ts                          ← MODIFY: add notifyB2bInvoiceSent()
components/admin/b2b-accounts-table.tsx              ← MODIFY: add invoice management section
```

**Total: 0 new files, 10 modified files**

**What NOT to create:**
- No `server/api/routes/b2b-invoices.ts` — B2B invoice generation lives in `b2b-accounts.ts` (scoped to account ID), status transitions live in `admin-invoices.ts` (existing invoice management)
- No `components/admin/b2b-invoices-table.tsx` — invoice UI is part of the B2B account detail view (inline dialog pattern)
- No `server/api/lib/b2b-invoice-generator.ts` — extend existing `invoice-generator.ts`
- No `lib/b2b-invoicing/` directory — validators in `lib/validators.ts`, constants in `lib/constants.ts`
- No scheduled job/cron for overdue detection — admin-triggered status change is sufficient for current scale (3-50 B2B accounts)

**File modification order (dependency-driven):**
1. `db/schema/invoices.ts` → run `db:generate`
2. `lib/constants.ts` → `lib/validators.ts`
3. `server/api/lib/audit-logger.ts`
4. `server/api/lib/invoice-generator.ts`
5. `lib/notifications/email.ts` → `lib/notifications/index.ts`
6. `server/api/routes/b2b-accounts.ts` (add invoice endpoints)
7. `server/api/routes/admin-invoices.ts` (extend status + add send)
8. `components/admin/b2b-accounts-table.tsx` (add invoice UI)

### Testing Requirements

**No test framework is installed.** Do NOT generate test files unless explicitly asked. The project relies on TypeScript strict mode + Zod schema validation as the primary safety net.

**Manual verification checklist (dev should confirm each):**

1. **Schema verification:** Run `npm run db:generate` successfully — migration adds "overdue" to enum and new columns to invoices
2. **B2B invoice generation:** `POST /api/admin/b2b-accounts/:id/invoices` with valid billing period → invoice created with correct line items, tenantId, dueDate, status "draft"
3. **Empty period guard:** `POST /api/admin/b2b-accounts/:id/invoices` with period containing no completed bookings → 400 with descriptive error
4. **Duplicate prevention:** Generating invoice for same period twice → second booking already invoiced, returns error or empty
5. **Invoice send:** `POST /api/admin/invoices/:id/send` → status changes to "issued", issuedAt set, email sent to B2B billing contact
6. **Send validation:** `POST /api/admin/invoices/:id/send` on non-draft invoice → 400 error
7. **Mark paid:** `PATCH /api/admin/invoices/:id/status` with `{ "status": "paid" }` → paidAt set, status updated
8. **Mark overdue:** `PATCH /api/admin/invoices/:id/status` with `{ "status": "overdue" }` → status updated
9. **B2B invoice list:** `GET /api/admin/b2b-accounts/:id/invoices` → returns invoices filtered by tenantId
10. **Existing invoices unaffected:** Existing platform invoices (with bookingId, no tenantId) continue to work as before — dueDate/billingPeriod columns are nullable
11. **UI rendering:** B2B account detail shows invoice section, generate dialog works, action buttons trigger correct API calls, status badges display correctly

### Git Intelligence Summary

**Last 10 commits (most recent first):**

| Commit | Summary | Relevance |
|--------|---------|-----------|
| `9beb76b` | Add B2B account management with contract config, booking creation, notifications (Story 9.1) | **Critical** — direct predecessor, established B2B patterns, b2b-accounts.ts route to extend |
| `01d6ae6` | Add 1099 export, encrypted tax IDs, health monitoring, financial reports (5.1, 5.3) | High — financial-reports.ts B2B filtering, admin route patterns |
| `ff67ba5` | Add provider earnings view with daily/weekly aggregation (5.2) | Low — provider page pattern |
| `1059b97` | Combined retrospective for Epics 6, 7, 8 | Low — workflow artifact |
| `c391bba` | Fix 54 code review findings across Epics 6, 7, 8 | High — code quality standards, common mistakes to avoid |
| `44cdfd3` | Booking lifecycle notifications, push wiring, payment ops fixes | Medium — notification patterns |
| `724ddf6` | Real-time provider tracking with ETA, delay, GPS lifecycle | Low |
| `c679b15` | Batch payouts/refunds, booking UX, auto-dispatch with GPS | Medium — existing invoice generation patterns |
| `bb129e3` | Manual payment confirmation, receipt emails, SMS, payout fix | Medium — invoice-generator.ts patterns |
| `047d30c` | Tiered commission, service-level payout calculation, admin UI | Low |

**Key patterns from Story 9.1 (direct predecessor):**

1. **B2B route structure** — `server/api/routes/b2b-accounts.ts` uses `requireAdmin` + `rateLimitStandard`, typed `AuthEnv`, Zod safeParse + audit logging. Story 9.2 adds 2 endpoints to this same file.

2. **Code review fixes from 9.1** — `notifyB2bServiceDispatched()` was initially not wired in; `safeParse` was missing on one endpoint; booking count was missing from list. **Do not repeat these mistakes** — ensure every endpoint uses safeParse, every notification is actually called, and list endpoints include relevant counts.

3. **B2B invoice email pattern** — `sendB2bServiceDispatchedEmail()` in `lib/notifications/email.ts` includes unsubscribe link and uses `getResend()` pattern. B2B invoice email should follow the same structure.

4. **Existing invoice infrastructure** — `invoice-generator.ts` has `generateInvoiceNumber()` (sequential) and `createInvoiceForBooking()` (per-booking). The B2B generator is conceptually similar but aggregates multiple bookings into one invoice.

### Existing Infrastructure Leveraged (minimal or zero modifications needed)

| Component | File | How it helps |
|-----------|------|--------------|
| Invoice table with tenantId | `db/schema/invoices.ts:40` | `tenantId` column already exists — set to B2B account ID |
| Invoice number generator | `server/api/lib/invoice-generator.ts:11-25` | `generateInvoiceNumber()` reusable for B2B invoices |
| Admin invoices route | `server/api/routes/admin-invoices.ts` | Extend existing PATCH /:id/status handler |
| Invoice HTML generator | `lib/invoices/generate-invoice-html.ts` | Reuse for B2B invoice email body |
| B2B accounts route | `server/api/routes/b2b-accounts.ts` | Add invoice endpoints alongside existing B2B management |
| Existing audit actions | `server/api/lib/audit-logger.ts` | invoice.generate, invoice.issue, invoice.void already exist — add 4 new ones |
| Notification infrastructure | `lib/notifications/` | Email pattern established, add B2B invoice email |
| B2B accounts schema | `db/schema/b2b-accounts.ts` | Query account for contactEmail, paymentTerms, companyName |

### Project Structure Notes

- **No new files** — all changes extend existing infrastructure
- This is architecturally the simplest story in the project — no new tables, no new route modules, no new pages, no new components
- The `invoices.tenantId` column was pre-positioned in the original schema for exactly this use case
- Invoice status enum extension is a safe PostgreSQL operation (`ALTER TYPE ... ADD VALUE`)
- B2B invoice UI fits naturally into the existing B2B account detail dialog (already has list, create, edit, contract, booking modes — invoice becomes the 6th mode)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9] — Story 9.2 ACs, FRs 60-63
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns] — "B2B account isolation uses existing tenantId pattern"
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — Naming, structure, format, API response patterns
- [Source: docs/project-context.md] — 127 implementation rules, anti-patterns, stack versions
- [Source: db/schema/invoices.ts] — Existing invoice schema with tenantId (line 40), InvoiceLineItem type, statusEnum
- [Source: server/api/lib/invoice-generator.ts] — `generateInvoiceNumber()`, `createInvoiceForBooking()` patterns
- [Source: server/api/routes/admin-invoices.ts] — Existing PATCH /:id/status, POST /generate patterns
- [Source: server/api/routes/b2b-accounts.ts] — B2B route module to extend with invoice endpoints
- [Source: db/schema/b2b-accounts.ts] — B2B account schema with paymentTerms, contactEmail
- [Source: lib/notifications/email.ts] — `sendB2bServiceDispatchedEmail()` as template for invoice email
- [Source: _bmad-output/implementation-artifacts/9-1-b2b-account-and-contract-management.md] — Story 9.1 learnings, code review fixes, established patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (Story Creation — BMad Method Create Story workflow)

### Debug Log References

_No debug issues encountered during implementation._

### Completion Notes List

- Story created: 2026-02-19
- Implementation completed: 2026-02-19
- Code review completed: 2026-02-19
- Status: done
- Epic 9 status: in-progress (unchanged from Story 9.1)
- FR coverage: FR60 (monthly invoices), FR61 (invoice status tracking), FR62 (invoice email), FR63 (resident dispatch notification — expanded from 9.1's partial coverage)
- NFR50 compliance: CAN-SPAM unsubscribe link in invoice email
- Zero new npm dependencies required
- 0 new files, 10 modified files
- Heaviest lift: `createB2bMonthlyInvoice()` function in invoice-generator.ts (multi-booking aggregation) and UI invoice section in b2b-accounts-table.tsx
- Lightest lift: schema change (2 columns + 1 enum value), constants, validators, audit actions
- Existing infrastructure: invoices.tenantId pre-positioned, generateInvoiceNumber() reusable, admin-invoices route extensible

### File List

**New:**
_(none)_

**Modified:**
- `db/schema/invoices.ts`
- `db/migrations/0016_brave_ogun.sql` (generated)
- `lib/constants.ts`
- `lib/validators.ts`
- `server/api/lib/audit-logger.ts`
- `server/api/lib/invoice-generator.ts`
- `server/api/routes/b2b-accounts.ts`
- `server/api/routes/admin-invoices.ts`
- `server/api/routes/provider-invoices.ts` (narrowing fix for expanded status enum)
- `lib/notifications/email.ts`
- `lib/notifications/index.ts`
- `components/admin/b2b-accounts-table.tsx`

## Change Log

- 2026-02-19: Implemented Story 9.2 — B2B Invoicing & Billing. Added invoice schema extensions (overdue status, dueDate, billingPeriod columns), B2B monthly invoice generator, send/mark-paid/mark-overdue endpoints, email notifications with CAN-SPAM compliance, and admin UI invoice management dialog.
- 2026-02-19: Code review fixes — (H1) Added "overdue" to INVOICE_STATUSES constant, (H2) Added ISO date regex + end>=start refinement to generateB2bInvoiceSchema, (H3) Added duplicate billing period prevention in createB2bMonthlyInvoice, (M4) Added escapeHtml() for XSS prevention in invoice email template, (M5) Wrapped notifyB2bInvoiceSent in Promise.allSettled for pattern consistency, (M6) Added toast.error on non-OK invoice fetch response, (M7) Added per-action loading/disabled state for invoice action buttons, (L9) Added invoice status transition validation state machine in admin-invoices PATCH.
