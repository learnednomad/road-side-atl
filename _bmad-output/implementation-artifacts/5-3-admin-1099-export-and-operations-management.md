# Story 5.3: Admin 1099 Export & Operations Management

Status: done

## Story

As an admin,
I want to export provider earnings in 1099-ready format and manage all bookings from the admin dashboard,
so that I can fulfill tax reporting obligations and efficiently oversee operations.

## Acceptance Criteria

1. **Given** the existing users table needs tax identification support for providers **When** the migration runs **Then** a `taxId` (text, nullable) column is added to the users table **And** the column value is encrypted at rest using AES-256 or equivalent (NFR13) **And** only users with role "provider" will have this field populated.

2. **Given** I am an authenticated admin at year-end **When** I click "Export 1099 Data" **Then** the system generates a CSV download with columns: Provider Name, Tax ID (decrypted for export, encrypted at rest per NFR13), Total Earnings (cents), Calendar Year **And** the export filters by tax year and includes only providers with earnings above the IRS 1099-NEC reporting threshold ($600).

3. **Given** I am on the admin dashboard **When** I navigate to the bookings section **Then** I can view and manage all active, completed, and cancelled bookings (FR78) **And** I can add internal notes to booking records that are not visible to customers (FR79).

4. **Given** I am on the admin dashboard **When** I view the system health widget **Then** I see WebSocket connection status, deployment health, and database connectivity (FR81) **And** the health endpoint responds within 5 seconds (NFR37).

## Tasks / Subtasks

- [x] Task 1: Add taxId column with AES-256 encryption (AC: #1)
  - [x] 1.1 Create `server/api/lib/encryption.ts` — AES-256-GCM encrypt/decrypt utility using Node.js `crypto` module with `ENCRYPTION_KEY` env var
  - [x] 1.2 Add `taxId` (text, nullable) column to `db/schema/users.ts`
  - [x] 1.3 Run `npm run db:push` to sync schema
  - [x] 1.4 Add `PUT /api/admin/providers/:id/tax-id` endpoint in `server/api/routes/admin-providers.ts` — accepts plaintext taxId, encrypts via utility, stores encrypted value
  - [x] 1.5 Add `GET /api/admin/providers/:id/tax-id` endpoint — decrypts and returns plaintext (admin-only, audit-logged)
- [x] Task 2: 1099 CSV export endpoint (AC: #2)
  - [x] 2.1 Add `GET /api/admin/providers/1099-export?year=2026` endpoint in `server/api/routes/admin-providers.ts`
  - [x] 2.2 Query: join providers → providerPayouts, sum earnings by provider for calendar year, filter >= 60000 cents ($600 threshold)
  - [x] 2.3 Decrypt taxId for each qualifying provider in the export
  - [x] 2.4 Return CSV using existing `generateCSV()` from `lib/csv.ts` with headers: Provider Name, Tax ID, Total Earnings, Calendar Year
  - [x] 2.5 Audit log the export action
- [x] Task 3: Admin booking notes edit UI (AC: #3)
  - [x] 3.1 Add notes edit form to `app/(admin)/admin/bookings/[id]/page.tsx` — textarea with save button below existing notes display
  - [x] 3.2 Add `PATCH /api/admin/bookings/:id/notes` endpoint in `server/api/routes/admin.ts` — updates `notes` field on booking
  - [x] 3.3 Audit log the notes update
- [x] Task 4: 1099 export UI (AC: #2)
  - [x] 4.1 Add "1099 Export" section to an admin page (e.g., `app/(admin)/admin/providers/page.tsx` or a dedicated 1099 page)
  - [x] 4.2 Year selector dropdown (default: current year) + "Export 1099 Data" button using `ExportButton` component
  - [x] 4.3 Show count of qualifying providers before export
- [x] Task 5: Tax ID management UI (AC: #1)
  - [x] 5.1 Add taxId input field to provider detail/settings in admin panel — masked display (***-**-1234), edit button reveals full value (admin only)
  - [x] 5.2 Validate format: SSN (XXX-XX-XXXX) or EIN (XX-XXXXXXX) via Zod schema
- [x] Task 6: System health endpoint and widget (AC: #4)
  - [x] 6.1 Create `GET /api/health` endpoint (public, no auth required) in a new section of `server/api/index.ts` or a dedicated health route
  - [x] 6.2 Check database connectivity via `SELECT 1` query with 3-second timeout
  - [x] 6.3 Check WebSocket server status — ping the ws server or check connection count
  - [x] 6.4 Check Stripe API reachability via `stripe.balance.retrieve()` with timeout
  - [x] 6.5 Return health status JSON with individual check results, respond within 5 seconds total (NFR37)
  - [x] 6.6 Add system health widget to admin overview page (`app/(admin)/admin/page.tsx` or `overview-client.tsx`) — colored indicators (green/yellow/red) for each service

## Dev Notes

### CRITICAL: What Already Exists (DO NOT Rebuild)

| Existing File | What It Does | Your Relationship |
|---|---|---|
| `app/(admin)/admin/bookings/page.tsx` | SSR booking list with pagination | **DO NOT TOUCH** — FR78 already works |
| `app/(admin)/admin/bookings/[id]/page.tsx` | Booking detail with read-only notes display (lines 302-312) | **MODIFY** — add notes edit form below existing display |
| `components/admin/bookings-table.tsx` | Booking table with status filter, search, WebSocket updates, export | **DO NOT TOUCH** — FR78 already works |
| `server/api/routes/admin.ts` | Core admin endpoints including booking status updates | **EXTEND** — add notes PATCH endpoint |
| `server/api/routes/admin-providers.ts` | Provider management endpoints | **EXTEND** — add taxId and 1099 export endpoints |
| `lib/csv.ts` | `generateCSV(headers, rows)` + `exportToCSV(data, filename)` | **REUSE** — use for 1099 CSV generation |
| `components/admin/export-button.tsx` | CSV download button component | **REUSE** — use for 1099 export UI |
| `app/(admin)/admin/page.tsx` + `overview-client.tsx` | Admin dashboard with stats cards and sparklines | **MODIFY** — add system health widget |
| `db/schema/users.ts` | Users table schema | **MODIFY** — add taxId column |
| `server/api/routes/auth.ts` | Uses `bcryptjs` for password hashing | **REFERENCE** — only existing crypto pattern; taxId needs different approach (AES-256-GCM) |

### AES-256-GCM Encryption Implementation

Create `server/api/lib/encryption.ts`:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY environment variable required");
  // Key must be 32 bytes for AES-256
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as: iv:tag:ciphertext (all hex-encoded)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encryptedStr: string): string {
  const [ivHex, tagHex, ciphertextHex] = encryptedStr.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
```

**ENCRYPTION_KEY env var**: Generate a 32-byte hex key: `openssl rand -hex 32`. Add to `.env` and deployment config. Add to `serverExternalPackages` if needed (Node.js `crypto` is built-in, should be fine).

### 1099 Export Query Pattern

```typescript
// Sum provider earnings for a calendar year, filter >= $600
const yearStart = new Date(`${year}-01-01`);
const yearEnd = new Date(`${year + 1}-01-01`);

const earnings = await db
  .select({
    providerId: providerPayouts.providerId,
    providerName: providers.name,
    totalEarnings: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
  })
  .from(providerPayouts)
  .innerJoin(providers, eq(providerPayouts.providerId, providers.id))
  .where(and(
    sql`${providerPayouts.createdAt} >= ${yearStart.toISOString()}`,
    sql`${providerPayouts.createdAt} < ${yearEnd.toISOString()}`,
    eq(providerPayouts.payoutType, "standard"), // exclude clawbacks
  ))
  .groupBy(providerPayouts.providerId, providers.name)
  .having(sql`sum(${providerPayouts.amount}) >= 60000`); // $600 = 60000 cents

// Then for each, join to users to get taxId and decrypt
```

**IRS threshold**: $600 (60000 cents) for 1099-NEC reporting. Use a constant: `const IRS_1099_THRESHOLD_CENTS = 60000;` in `lib/constants.ts`.

### Admin Notes PATCH Endpoint

Add to `server/api/routes/admin.ts`:
```typescript
// Admin internal notes on booking (FR79)
app.patch("/bookings/:id/notes", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = z.object({ notes: z.string().max(2000) }).safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);

  const [updated] = await db
    .update(bookings)
    .set({ notes: parsed.data.notes, updatedAt: new Date() })
    .where(eq(bookings.id, id))
    .returning();

  if (!updated) return c.json({ error: "Booking not found" }, 404);

  const user = c.get("user");
  logAudit({ action: "booking.update_notes", userId: user.id, details: { bookingId: id } });

  return c.json({ success: true });
});
```

**Route ordering**: Place this BEFORE any generic `/bookings/:id` PATCH handler if one exists.

### Notes Edit UI Pattern

In booking detail page, replace the read-only notes card:
```typescript
"use client";
// Add state for notes editing
const [notes, setNotes] = useState(booking.notes || "");
const [saving, setSaving] = useState(false);

async function handleSaveNotes() {
  setSaving(true);
  const res = await fetch(`/api/admin/bookings/${booking.id}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  setSaving(false);
  if (res.ok) toast.success("Notes saved");
  else toast.error("Failed to save notes");
}

// Textarea + Save button in a Card
```

**Important**: The booking detail page at `app/(admin)/admin/bookings/[id]/page.tsx` is currently a **Server Component** (316 lines). The notes edit form needs interactivity. Options:
1. Extract notes section to a small client component (e.g., `components/admin/booking-notes-editor.tsx`) imported into the server page — **PREFERRED**
2. Convert entire page to client — **AVOID** (breaks SSR data fetching pattern)

### Health Endpoint Design

```typescript
// Register at app level in server/api/index.ts (public, no auth)
app.get("/health", async (c) => {
  const checks: Record<string, { status: string; latency?: number }> = {};

  // DB check
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "healthy", latency: Date.now() - dbStart };
  } catch {
    checks.database = { status: "unhealthy", latency: Date.now() - dbStart };
  }

  // Stripe check
  const stripeStart = Date.now();
  try {
    if (process.env.STRIPE_SECRET_KEY) {
      // Use Stripe API ping — balance.retrieve is lightweight
      await stripe.balance.retrieve();
      checks.stripe = { status: "healthy", latency: Date.now() - stripeStart };
    } else {
      checks.stripe = { status: "unconfigured" };
    }
  } catch {
    checks.stripe = { status: "unhealthy", latency: Date.now() - stripeStart };
  }

  // WebSocket check — verify ws server is listening
  // Check if the WebSocket module exports a connection count or status
  checks.websocket = { status: "healthy" }; // Implement based on ws server exports

  const allHealthy = Object.values(checks).every(c => c.status === "healthy" || c.status === "unconfigured");

  return c.json({
    status: allHealthy ? "healthy" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  }, allHealthy ? 200 : 503);
});
```

**NFR37**: Must respond within 5 seconds. Add individual timeouts (3s for DB, 3s for Stripe). Use `Promise.race` with timeout for each check.

**Important**: Health endpoint is PUBLIC (no auth) — it's called by Docker health checks and monitoring. Do NOT put behind `requireAdmin`.

### Health Widget UI

Add to `overview-client.tsx` or create `components/admin/health-widget.tsx`:
```typescript
// Fetch /api/health on interval (every 30 seconds)
// Display colored dots: green=healthy, yellow=degraded, red=unhealthy
// Show: Database, WebSocket, Stripe with latency
```

### Project Structure Notes

New files to create:
- `server/api/lib/encryption.ts` — AES-256-GCM encrypt/decrypt utility
- `components/admin/booking-notes-editor.tsx` — client component for notes editing
- `components/admin/health-widget.tsx` — system health display widget

Files to modify:
- `db/schema/users.ts` — add `taxId` column
- `server/api/routes/admin-providers.ts` — add taxId management + 1099 export endpoints
- `server/api/routes/admin.ts` — add booking notes PATCH endpoint
- `server/api/index.ts` — add health endpoint (public, at app level before auth routes)
- `app/(admin)/admin/bookings/[id]/page.tsx` — import BookingNotesEditor component
- `app/(admin)/admin/page.tsx` or `overview-client.tsx` — add health widget
- `lib/constants.ts` — add `IRS_1099_THRESHOLD_CENTS = 60000`

Files to REFERENCE (read patterns, do NOT modify):
- `lib/csv.ts` — CSV generation utility (import `generateCSV`)
- `components/admin/export-button.tsx` — CSV export button (import and reuse)
- `server/api/routes/admin-finances.ts` — SQL aggregation patterns
- `server/api/routes/auth.ts` — existing crypto pattern (bcryptjs for passwords)

### Architecture Compliance

- **Route pattern**: Extend existing route files, don't create new route modules for this story
- **Auth**: `requireAdmin` on all admin endpoints. Health endpoint is PUBLIC
- **Money**: All amounts in cents. IRS threshold = 60000 cents
- **Encryption**: AES-256-GCM via Node.js built-in `crypto` — no new npm dependency needed
- **No try-catch**: Health endpoint is the ONE exception — each check needs individual try-catch to report per-service status
- **Zod v4**: `import { z } from "zod/v4"` for input validation
- **Named exports**: All new components use named exports
- **Manual updatedAt**: Include `updatedAt: new Date()` in the booking notes update
- **`serverExternalPackages`**: Node.js `crypto` is built-in, no changes needed to `next.config.ts`
- **Audit logging**: Log taxId access (view/update), 1099 export, and notes updates
- **NFR13**: taxId encrypted at rest, decrypted only for 1099 export and admin view — never stored or transmitted in plaintext except in the export CSV
- **NFR37**: Health endpoint responds within 5 seconds with timeout per check

### Previous Story Intelligence

From Story 5-1 (if implemented first):
- `financial-reports.ts` route module will be created — do NOT duplicate any financial endpoints
- Admin dashboard may have new sections — coordinate health widget placement

From Story 3.3 (Payouts):
- **Clawback exclusion**: When summing earnings for 1099, filter `payoutType = 'standard'` — exclude clawbacks which have negative amounts
- **Payout status**: Include both `pending` and `paid` payouts in 1099 totals (earnings are earned regardless of payout status)

From Story 4.6 (Booking Lifecycle):
- Booking detail page is Server Component — extract interactive parts to client components (established pattern)

### Security Considerations

- **ENCRYPTION_KEY rotation**: If the key changes, all existing encrypted taxIds become unreadable. Document the key in deployment secrets
- **Audit trail**: Every taxId view/update and 1099 export must be audit-logged — this is sensitive PII
- **Rate limiting**: Apply `rateLimitStrict` on taxId endpoints to prevent enumeration
- **Export security**: 1099 CSV contains decrypted SSN/EIN — ensure HTTPS-only, no caching headers

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 Story 5.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#NFR13 SSN/EIN encryption]
- [Source: _bmad-output/project-context.md#Adding New Features Checklist]
- [Source: db/schema/users.ts — users table schema]
- [Source: db/schema/bookings.ts — notes field exists]
- [Source: app/(admin)/admin/bookings/[id]/page.tsx — booking detail with read-only notes]
- [Source: lib/csv.ts — CSV generation utility]
- [Source: server/api/routes/admin-providers.ts — provider management endpoints]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- No debug issues encountered. TypeScript compilation passed with 0 errors in modified files (1 pre-existing error in unrelated admin.ts:159). ESLint passed with 0 errors across all 13 modified/new files.

### Completion Notes List

- **Task 1**: Created `server/api/lib/encryption.ts` with AES-256-GCM encrypt/decrypt using Node.js `crypto` module. Added `taxId` (text, nullable) column to users schema and synced via `db:push`. Added `PUT /:id/tax-id` (encrypt + store) and `GET /:id/tax-id` (decrypt + return) endpoints with rate limiting (`rateLimitStrict`) and audit logging for both view and update operations. Zod validation enforces SSN (XXX-XX-XXXX) or EIN (XX-XXXXXXX) format.
- **Task 2**: Added `GET /1099-export?year=YYYY` endpoint that joins providers → providerPayouts, sums standard-type earnings per calendar year, filters at $600 (60000 cents) IRS threshold, decrypts taxIds, and returns CSV via existing `generateCSV()`. Added `GET /1099-count?year=YYYY` helper for UI preview count. Export includes `Cache-Control: no-store` header. Added `IRS_1099_THRESHOLD_CENTS` constant. Audit logs every export action.
- **Task 3**: Created `BookingNotesEditor` client component (textarea + save button, 2000 char limit). Replaced read-only notes section in booking detail page. Added `PATCH /bookings/:id/notes` endpoint with Zod validation, rate limiting, and audit logging. The booking detail page remains a Server Component with the notes editor extracted as a client island.
- **Task 4**: Created `TaxExportSection` client component with year selector (last 5 years), ExportButton wired to 1099-export endpoint, and qualifying provider count display. Integrated into the admin providers page above the providers table.
- **Task 5**: Created `TaxIdManager` client component with masked display (***-**-1234), reveal/hide toggle via Eye/EyeOff icons, and edit mode with format validation. Integrated into the provider edit dialog in providers-table.tsx (shown only for providers with linked user accounts).
- **Task 6**: Added public `GET /api/health` endpoint in server/api/index.ts (no auth required). Checks: database (SELECT 1 with 3s timeout via Promise.race), WebSocket server status + connection count, Stripe API via balance.retrieve with 3s timeout. Returns per-service status (healthy/unhealthy/unconfigured) with latency. Overall status: healthy or degraded (503). Created `HealthWidget` client component with colored status dots (green/yellow/red/gray), latency display, and WS connection count. Polls every 30 seconds. Integrated into admin dashboard overview page. Added `getConnectionCount()` to websocket/connections.ts.

### File List

- `server/api/lib/encryption.ts` — New: AES-256-GCM encrypt/decrypt utility
- `db/schema/users.ts` — Modified: added taxId column
- `lib/constants.ts` — Modified: added IRS_1099_THRESHOLD_CENTS constant
- `server/api/lib/audit-logger.ts` — Modified: added 4 new audit action types (view_tax_id, update_tax_id, 1099_export, update_notes)
- `server/api/routes/admin-providers.ts` — Modified: added 1099-export, 1099-count, tax-id GET/PUT endpoints with rate limiting
- `server/api/routes/admin.ts` — Modified: added booking notes PATCH endpoint with Zod validation
- `server/api/index.ts` — Modified: added public /health endpoint with DB, WS, Stripe checks
- `server/websocket/connections.ts` — Modified: added getConnectionCount() export
- `components/admin/booking-notes-editor.tsx` — New: client component for editable booking notes
- `components/admin/health-widget.tsx` — New: system health dashboard widget
- `components/admin/tax-id-manager.tsx` — New: masked tax ID view/edit component
- `components/admin/tax-export-section.tsx` — New: 1099 export UI with year selector and count
- `components/admin/providers-table.tsx` — Modified: integrated TaxIdManager in edit dialog
- `app/(admin)/admin/bookings/[id]/page.tsx` — Modified: replaced read-only notes with BookingNotesEditor
- `app/(admin)/admin/providers/page.tsx` — Modified: added TaxExportSection
- `app/(admin)/admin/overview-client.tsx` — Modified: added HealthWidget to dashboard

## Change Log

- 2026-02-18: Implemented Story 5.3 — Admin 1099 Export & Operations Management. Added AES-256-GCM encrypted taxId storage, 1099 CSV export with IRS threshold filtering, editable booking notes, tax ID management UI, and system health monitoring endpoint/widget.
- 2026-02-18: Code review fixes — (H1) Added format validation to decrypt() for malformed input, (M1) Replaced N+1 user queries in 1099 export with batch inArray() fetch, (M2) Added ENCRYPTION_KEY 32-byte length validation, (M3) Parallelized DB+Stripe health checks with Promise.all to meet NFR37 5s limit, (L1) Added autoComplete="off" to tax ID input, (L2) Health widget now shows "Unavailable" on fetch failure instead of permanent "Loading...".
