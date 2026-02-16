# Story 8.1: Inspection Report Schema & Provider Submission

Status: review

## Story

As a provider,
I want to capture and submit structured inspection findings including OBD2 data, photos, and measurements,
so that the data is organized for professional report generation and the customer receives a pre-service confirmation with inspector details.

## Acceptance Criteria

1. **Inspection Reports Table** - Given the `inspection_reports` table does not exist, when the migration runs, then the table is created with: id, bookingId (FK bookings), providerId (text), findings (JSONB typed as `InspectionFinding[]`), reportUrl (text, nullable), emailedAt (timestamp, nullable), createdAt.

2. **Provider Inspection Form** - Given I am assigned to a diagnostic inspection booking, when I open the inspection form, then I see structured fields for OBD2 codes, component measurements, photo uploads, and condition ratings (good/fair/poor/critical) organized by category.

3. **Inspection Submission** - Given I complete the inspection, when I submit findings, then the inspection report record is saved with structured JSONB data and an audit entry is logged with `inspection.generate`.

4. **HTML Preview** - Given I have submitted an inspection report, when the customer or I view the report, then an HTML preview is immediately available with all findings data, vehicle info, and provider name.

5. **Duplicate Prevention** - Given I have already submitted an inspection report for a booking, when I try to submit again, then I receive a 409 error: "Inspection report already submitted for this booking".

6. **Pre-Service Confirmation** - Given the customer has booked a diagnostic inspection, when a provider is assigned to their inspection booking, then the customer receives a confirmation notification with the inspector's name and estimated arrival time.

7. **Provider Report List** - Given I am a provider, when I navigate to the inspections page, then I see a paginated list of my submitted inspection reports with date, customer name, vehicle info, finding count, worst condition badge, email status, and PDF/email actions.

## Tasks / Subtasks

- [x] Task 1: Schema (AC: #1)
  - [x] 1.1 Verify `db/schema/inspection-reports.ts` exists with correct `InspectionFinding` type and `inspectionReports` table
  - [x] 1.2 Verify export from `db/schema/index.ts`
  - [x] 1.3 Run `npm run db:generate` to create migration (if table does not yet exist in DB)
  - [x] 1.4 Run `npm run db:migrate` to apply migration

- [x] Task 2: Constants and validators (AC: #2, #3)
  - [x] 2.1 Verify `INSPECTION_CONDITIONS` constant exists in `lib/constants.ts`
  - [x] 2.2 Verify `createInspectionReportSchema` Zod schema exists in `lib/validators.ts`

- [x] Task 3: Audit logger extension (AC: #3)
  - [x] 3.1 Verify `inspection.generate` and `inspection.email_sent` exist in AuditAction type in `server/api/lib/audit-logger.ts`

- [x] Task 4: Pre-service confirmation notification (AC: #6)
  - [x] 4.1 Add `sendPreServiceConfirmationSMS` to `lib/notifications/sms.ts` — message includes inspector name and ETA
  - [x] 4.2 Add `sendPreServiceConfirmationEmail` to `lib/notifications/email.ts` — email includes inspector name, ETA, service details, and unsubscribe link (NFR50)
  - [x] 4.3 Add `notifyPreServiceConfirmation` orchestrator to `lib/notifications/index.ts` using `Promise.allSettled()`
  - [x] 4.4 Integrate `notifyPreServiceConfirmation` call in the provider assignment flow (fire-and-forget) — when a provider is assigned to a diagnostic/inspection booking, trigger the notification with inspector name and estimated arrival

- [x] Task 5: API route (AC: #3, #4, #5, #7)
  - [x] 5.1 Verify `server/api/routes/inspection-reports.ts` exists with POST /, GET /provider/list, GET /:id, GET /:id/pdf, POST /:id/email
  - [x] 5.2 Verify route registered in `server/api/index.ts`: `app.route("/inspection-reports", inspectionReportsRoutes)`

- [x] Task 6: Frontend (AC: #2, #4, #7)
  - [x] 6.1 Verify `components/provider/inspection-form.tsx` exists with structured finding entry (category, component, condition, description, measurement, OBD code)
  - [x] 6.2 Verify `app/(provider)/provider/inspections/page.tsx` exists with paginated report list, PDF download, and email send actions
  - [x] 6.3 Verify Inspections nav link exists in `components/provider/provider-sidebar.tsx` and `provider-mobile-nav.tsx`
  - [x] 6.4 Create `components/provider/inspection-preview.tsx` — HTML preview component for rendering inspection findings with vehicle info, provider name, condition badges, and formatted findings list

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**Inspection reports are a first-class entity.** Separate `inspection_reports` table, NOT embedded in bookings. JSONB `findings` column typed via `.$type<InspectionFinding[]>()`. Structured data supports HTML preview (instant, mobile-friendly) + PDF download (branded, professional via `@react-pdf/renderer` in Story 8.2).

**PDF generation is Story 8.2 scope.** This story creates the data model, provider submission form, and HTML preview. The `@react-pdf/renderer` PDF generation and email delivery pipeline is Story 8.2. However, the existing code already includes PDF generation and email endpoints — verify they work correctly.

**Pre-service confirmation is FR66.** When a provider is assigned to a diagnostic/inspection booking, the customer must receive a notification with the inspector's name and estimated arrival time. This requires integrating into the provider assignment flow (likely in the bookings or dispatch route handler).

**Integer math only.** No floating point anywhere. Money in cents, multipliers in basis points.

**No test framework installed.** Do NOT create test files.

### Existing Code You MUST Understand

**IMPORTANT: Much of Story 8.1 is already implemented.** The schema, API routes, frontend page, form component, constants, validators, audit actions, notification functions, and navigation links ALL exist. The primary remaining work is:
1. Verifying existing implementations match the acceptance criteria
2. Adding pre-service confirmation notifications (FR66) — NOT yet implemented
3. Creating the HTML preview component — NOT yet created

**Inspection Reports schema** — `db/schema/inspection-reports.ts` (EXISTS):
```typescript
export type InspectionFinding = {
  category: string;
  component: string;
  condition: "good" | "fair" | "poor" | "critical";
  description: string;
  measurement?: string;
  photoUrl?: string;
  obdCode?: string;
};

export const inspectionReports = pgTable("inspection_reports", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  bookingId: text("bookingId").notNull().references(() => bookings.id),
  providerId: text("providerId").notNull(),
  findings: jsonb("findings").$type<InspectionFinding[]>().notNull(),
  reportUrl: text("reportUrl"),
  emailedAt: timestamp("emailedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
```

Note: No `updatedAt` column — inspection reports are immutable once submitted (only `emailedAt` gets set later). `providerId` has no FK reference (matches existing pattern for provider ID on bookings).

**API route** — `server/api/routes/inspection-reports.ts` (EXISTS):
- `POST /` — Submit inspection report. Validates body with `createInspectionReportSchema`. Looks up provider by `providers.userId`. Verifies booking exists and belongs to provider. Checks for duplicate (409). Inserts report. Logs `inspection.generate` audit.
- `GET /provider/list` — Paginated list of provider's reports. Joins with bookings and services.
- `GET /:id` — Single report with booking and service data. Access-controlled (provider, admin, or customer).
- `GET /:id/pdf` — PDF generation via `generateInspectionPDF()`.
- `POST /:id/email` — Email report to customer. Fire-and-forget via `notifyInspectionReport()`. Updates `emailedAt`. Logs `inspection.email_sent` audit.

Route registered as: `app.route("/inspection-reports", inspectionReportsRoutes)` in `server/api/index.ts`.

**Frontend page** — `app/(provider)/provider/inspections/page.tsx` (EXISTS): Client component with paginated table showing date, customer, vehicle, findings count, worst condition badge, email status, and PDF download / email send actions.

**Inspection form** — `components/provider/inspection-form.tsx` (EXISTS): Client component with dynamic add/remove findings. Each finding has: category, component, condition select (good/fair/poor/critical), OBD code, description, measurement. Handles 409 duplicate gracefully.

**Constants** — `lib/constants.ts` (EXISTS):
```typescript
export const INSPECTION_CONDITIONS = ["good", "fair", "poor", "critical"] as const;
export type InspectionCondition = (typeof INSPECTION_CONDITIONS)[number];
```

**Validators** — `lib/validators.ts` (EXISTS):
```typescript
export const createInspectionReportSchema = z.object({
  bookingId: z.string().uuid("Invalid booking"),
  findings: z.array(z.object({
    category: z.string().min(1, "Category is required"),
    component: z.string().min(1, "Component is required"),
    condition: z.enum(["good", "fair", "poor", "critical"]),
    description: z.string().min(1, "Description is required"),
    measurement: z.string().optional(),
    photoUrl: z.string().url().optional(),
    obdCode: z.string().optional(),
  })).min(1, "At least one finding is required"),
});
```

**Audit actions** — `server/api/lib/audit-logger.ts` (EXISTS): `inspection.generate` and `inspection.email_sent` already in AuditAction type.

**Notifications** — `lib/notifications/email.ts` (EXISTS): `sendInspectionReportEmail()` for emailing report to customer. `lib/notifications/index.ts` (EXISTS): `notifyInspectionReport()` orchestrator.

**Navigation** — Both `components/provider/provider-sidebar.tsx` and `components/provider/provider-mobile-nav.tsx` already include:
```typescript
{ href: "/provider/inspections", label: "Inspections", icon: Search }
```

**Bookings table** — `db/schema/bookings.ts`: Has `contactName`, `contactEmail`, `contactPhone` fields used for customer notification. `serviceId` links to services table. `providerId` is text (intentionally no FK). `vehicleInfo` is JSONB with `{ year, make, model, color }`.

**Providers table** — `db/schema/providers.ts`: Linked to users via `userId` column. Route handlers must look up provider by `providers.userId` matching the auth user's id. Provider has `name` field for inspector name in notifications.

**Audit logger pattern** — `server/api/lib/audit-logger.ts`:
```typescript
const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
logAudit({
  action: "inspection.generate",
  userId: user.id,
  resourceType: "inspection_report",
  resourceId: report.id,
  details: { bookingId, findingCount: findings.length },
  ipAddress,
  userAgent,
});
```

**Notification pattern** — Fire-and-forget via `Promise.allSettled()`:
```typescript
notifyInspectionReport(customer, bookingId, vehicleDescription, reportUrl).catch(() => {});
```

**Existing constants pattern** — `lib/constants.ts`:
```typescript
export const INSPECTION_CONDITIONS = ["good", "fair", "poor", "critical"] as const;
```

**Existing validator pattern** — `lib/validators.ts`:
```typescript
import { z } from "zod/v4";  // NEVER "zod"
```

### Exact Implementation Specifications

**1. Pre-Service Confirmation SMS — `lib/notifications/sms.ts`:**

```typescript
export async function sendPreServiceConfirmationSMS(
  phone: string,
  inspectorName: string,
  eta: string
) {
  await sendSMS(
    phone,
    `RoadSide ATL: Your vehicle inspector ${inspectorName} is on the way! Estimated arrival: ${eta}. Reply STOP to opt out.`
  );
}
```

**2. Pre-Service Confirmation Email — `lib/notifications/email.ts`:**

```typescript
export async function sendPreServiceConfirmationEmail(
  email: string,
  customerName: string,
  inspectorName: string,
  eta: string,
  serviceName: string
) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: "RoadSide ATL <notifications@roadsideatl.com>",
    to: email,
    subject: `Your Inspector ${inspectorName} Is On the Way`,
    html: `
      <h2>Pre-Service Confirmation</h2>
      <p>Hi ${customerName},</p>
      <p>Your <strong>${serviceName}</strong> has been assigned to inspector <strong>${inspectorName}</strong>.</p>
      <p>Estimated arrival: <strong>${eta}</strong></p>
      <p>Please ensure the vehicle is accessible at the specified location.</p>
      <p>— RoadSide ATL</p>
      <p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/unsubscribe">unsubscribe here</a>.</p>
    `,
  });
}
```

**3. Pre-Service Confirmation Orchestrator — `lib/notifications/index.ts`:**

```typescript
export async function notifyPreServiceConfirmation(
  customer: { name: string; email: string; phone: string },
  inspectorName: string,
  eta: string,
  serviceName: string
) {
  await Promise.allSettled([
    sendPreServiceConfirmationEmail(customer.email, customer.name, inspectorName, eta, serviceName),
    sendPreServiceConfirmationSMS(customer.phone, inspectorName, eta),
  ]);
}
```

**4. Integration point — Provider assignment for diagnostic bookings:**

When a provider is assigned to an inspection/diagnostic booking (in the bookings or dispatch route handler), trigger:
```typescript
// Check if booking is for a diagnostic/inspection service
if (service.category === "diagnostic" || service.slug.includes("inspection")) {
  notifyPreServiceConfirmation(
    { name: booking.contactName, email: booking.contactEmail, phone: booking.contactPhone },
    provider.name,
    estimatedArrival,
    service.name,
  ).catch(() => {});
}
```

**5. HTML Preview Component — `components/provider/inspection-preview.tsx`:**

Server-accessible HTML rendering of inspection findings. Displays: vehicle info, inspection date, provider name, and all findings organized by category with condition badges. Used as the report view at `GET /api/inspection-reports/:id` and as fallback when PDF generation fails.

### Project Structure Notes

**Files to CREATE:**

| File | Purpose |
|---|---|
| `components/provider/inspection-preview.tsx` | HTML preview component for inspection findings |

**Files to MODIFY (append/extend):**

| File | What to Add |
|---|---|
| `lib/notifications/sms.ts` | `sendPreServiceConfirmationSMS` function |
| `lib/notifications/email.ts` | `sendPreServiceConfirmationEmail` function |
| `lib/notifications/index.ts` | `notifyPreServiceConfirmation` orchestrator + imports |
| Provider assignment handler (bookings or dispatch route) | Fire-and-forget `notifyPreServiceConfirmation()` call for diagnostic bookings |

**Files to VERIFY (already exist, confirm correctness):**

| File | What to Verify |
|---|---|
| `db/schema/inspection-reports.ts` | Schema matches AC #1 |
| `db/schema/index.ts` | Exports `inspection-reports` |
| `lib/constants.ts` | `INSPECTION_CONDITIONS` exists |
| `lib/validators.ts` | `createInspectionReportSchema` exists with correct shape |
| `server/api/lib/audit-logger.ts` | `inspection.generate` and `inspection.email_sent` in AuditAction |
| `server/api/routes/inspection-reports.ts` | All endpoints (POST /, GET /provider/list, GET /:id, GET /:id/pdf, POST /:id/email) |
| `server/api/index.ts` | Route registration for inspection-reports |
| `app/(provider)/provider/inspections/page.tsx` | Paginated report list with actions |
| `components/provider/inspection-form.tsx` | Structured finding form with condition ratings |
| `components/provider/provider-sidebar.tsx` | Inspections nav link |
| `components/provider/provider-mobile-nav.tsx` | Inspections nav link |
| `lib/notifications/email.ts` | `sendInspectionReportEmail` exists |
| `lib/notifications/index.ts` | `notifyInspectionReport` orchestrator exists |

**Files NOT to create:**
- NO `db/schema/inspection-findings.ts` — findings are JSONB inside inspection_reports, not a separate table
- NO `lib/inspections/` directory — validators in `lib/validators.ts`, constants in `lib/constants.ts`
- NO `types/inspections.ts` — types co-located in schema file
- NO admin inspection management page — this is provider-facing only
- NO `components/provider/inspection-checklist.tsx` — finding entry is integrated into the form component

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a separate findings table | Use JSONB `findings` column on `inspection_reports` table |
| Create `lib/inspections/` directory | Put constants in `lib/constants.ts`, validators in `lib/validators.ts` |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports `../` | Use `@/` path alias |
| Skip audit logging for inspection submissions | Log `inspection.generate` for every submission |
| Await notification calls | Fire-and-forget: `notifyPreServiceConfirmation(...).catch(() => {})` |
| Add try-catch in route handlers | Let Hono handle errors (exception: PDF generation which has a legitimate try-catch) |
| Add `updatedAt` to inspection_reports table | Inspection reports are immutable except `emailedAt` timestamp |
| Import `@react-pdf/renderer` in client components | Node-only, isolated in `server/api/lib/pdf-generator.ts` |
| Re-implement existing code that already works | Verify existing implementations, only modify if they don't match ACs |
| Send pre-service confirmation for non-diagnostic bookings | Only send for diagnostic/inspection service types |
| Create photo upload infrastructure | `photoUrl` field exists but upload infrastructure is future work |

### Dependencies and Scope

**This story blocks:** Story 8.2 (Branded PDF Generation & Email Delivery)

**This story does NOT include:**
- PDF generation via `@react-pdf/renderer` (Story 8.2 — but existing implementation already handles this)
- Configurable email delay for sending reports (Story 8.2)
- Photo upload implementation (`photoUrl` field exists but upload infrastructure is future work)
- Admin inspection management UI
- Customer-facing inspection report page (public URL)

**Scope boundary:** Schema verification + API route verification + provider frontend verification + pre-service confirmation notification (FR66) + HTML preview component. Most code already exists — the primary new work is FR66 (pre-service confirmation with inspector details) and the HTML preview component.

### Testing Guidance

No test framework is installed. Do NOT create test files. Verify manually:

1. Verify migration — confirm `inspection_reports` table exists with correct columns
2. Submit inspection report via POST — verify record saved, `inspection.generate` audit entry logged
3. Submit duplicate — verify 409 response with "Inspection report already submitted for this booking"
4. GET report by ID — verify HTML data returned with report, booking, and service details
5. GET provider report list — verify paginated results with booking and service joins
6. Assign provider to diagnostic booking — verify pre-service confirmation SMS and email sent with inspector name and ETA
7. Assign provider to non-diagnostic booking — verify NO pre-service confirmation sent
8. View inspection form — verify all fields present (category, component, condition, description, measurement, OBD code)
9. PDF download — verify PDF generates and downloads (existing implementation)
10. Email report — verify `emailedAt` set and `inspection.email_sent` audit logged (existing implementation)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8, Story 8.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Inspection Reports (Decision 1.4)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns - New Feature File Organization]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns - Notification Triggers]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: db/schema/inspection-reports.ts - Existing inspection reports table definition]
- [Source: db/schema/bookings.ts - Booking contact fields and vehicleInfo for notifications]
- [Source: server/api/lib/audit-logger.ts - Existing audit action types and logging pattern]
- [Source: server/api/routes/inspection-reports.ts - Existing API route implementation]
- [Source: lib/constants.ts - INSPECTION_CONDITIONS constant]
- [Source: lib/validators.ts - createInspectionReportSchema Zod schema]
- [Source: lib/notifications/index.ts - Existing notification orchestrator pattern]
- [Source: lib/notifications/email.ts - sendInspectionReportEmail function]
- [Source: components/provider/inspection-form.tsx - Existing inspection form component]
- [Source: app/(provider)/provider/inspections/page.tsx - Existing inspections list page]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Build validation passed cleanly — no errors

### Completion Notes List
- Tasks 1-3, 5-6 (verify): All existing infrastructure confirmed correct — schema, constants, validators, audit actions, API routes, frontend page, form, nav links all match ACs
- Task 4 (new work): Added pre-service confirmation notification (FR66) — SMS + email functions already existed from prior session, added `notifyPreServiceConfirmation` orchestrator and integrated into admin assign-provider handler with `diagnostics` category / `inspection` slug check
- Task 6.4 (new work): Created `inspection-preview.tsx` HTML preview component with grouped findings, condition badges, vehicle info, inspector name, and overall status

### Change Log
- `lib/notifications/index.ts` — Added `notifyPreServiceConfirmation` orchestrator using `Promise.allSettled()`
- `server/api/routes/admin.ts` — Imported `notifyPreServiceConfirmation`, added fire-and-forget call in assign-provider handler for diagnostics/inspection bookings
- `components/provider/inspection-preview.tsx` — Created HTML preview component for inspection findings

### File List
- `lib/notifications/index.ts` (modified)
- `server/api/routes/admin.ts` (modified)
- `components/provider/inspection-preview.tsx` (created)
