# Story 17.3: Observation to Mechanic Upsell

Status: backlog

## Story

As a customer,
I want to receive a follow-up notification with a link to book the matching mechanic service when my roadside provider observes a medium or high severity vehicle issue,
so that I can conveniently schedule a repair without searching for the right service.

## Acceptance Criteria

1. **Category-to-service mapping** - Given a hardcoded mapping exists in `server/api/lib/observation-upsell.ts`, when a provider submits an observation with category "Brakes", then the system maps it to mechanic service slug `brake-service`.

2. **Upsell link generation** - Given a medium or high severity observation is submitted, when the observation matches a mechanic service in the mapping, then a deep link URL is generated with query params `?service={serviceSlug}&vehicleYear={year}&vehicleMake={make}&vehicleModel={model}`.

3. **Follow-up notification includes upsell link** - Given upsell links are generated for matching observations, when the follow-up SMS/email is sent, then the notification body includes the deep link for each matched mechanic service.

4. **Non-matching categories ignored** - Given an observation category that does not map to any mechanic service (e.g., "Cosmetic"), when the observation is submitted, then no upsell link is generated for that item, and the existing follow-up notification proceeds without upsell content.

5. **Low severity excluded** - Given an observation with severity "low", when the observation is submitted, then no upsell matching occurs for that item regardless of category.

## Tasks / Subtasks

- [ ] Task 1: Create observation-upsell helper (AC: #1, #2, #4)
  - [ ] 1.1 Create `server/api/lib/observation-upsell.ts` with hardcoded `OBSERVATION_TO_MECHANIC_SERVICE` map
  - [ ] 1.2 Export `getUpsellLinks(items, vehicleInfo, baseUrl)` function that returns an array of `{ category, serviceSlug, deepLink }` for matching medium/high items
  - [ ] 1.3 Deep link format: `${baseUrl}/book?service=${serviceSlug}&vehicleYear=${year}&vehicleMake=${make}&vehicleModel=${model}`

- [ ] Task 2: Integrate upsell into observations handler (AC: #2, #3, #5)
  - [ ] 2.1 In `POST /api/observations` handler in `server/api/routes/observations.ts`, after saving observation and before follow-up notification, call `getUpsellLinks()` with the observation items and booking's `vehicleInfo`
  - [ ] 2.2 Pass upsell links to `notifyObservationFollowUp()` as an additional parameter
  - [ ] 2.3 Only process items with `severity === "medium"` or `severity === "high"` (existing filter applies)

- [ ] Task 3: Update notification templates (AC: #3)
  - [ ] 3.1 Modify `notifyObservationFollowUp()` in `lib/notifications/index.ts` to accept optional `upsellLinks` parameter
  - [ ] 3.2 Update email template to include upsell CTA for each matched service
  - [ ] 3.3 Update SMS template to include the first upsell deep link (SMS length constraint)

## Dev Notes

### Critical Architecture Constraints

**Hardcoded map, NOT a database table.** Architecture Decision 7 explicitly requires a hardcoded mapping for beta. Only ~6 mechanic services and ~8 observation categories. Do NOT create a migration or DB table.

**Fire-and-forget notifications.** The existing pattern uses `.catch((err) => { console.error("[Notifications] Failed:", err); })`. Follow this pattern for the upsell notification.

**Prices in cents.** If the upsell link includes price context, use integer cents.

**IDs are text with `createId()`.** No UUIDs for new records.

### Existing Code You MUST Understand

**Observation handler with follow-up** -- `server/api/routes/observations.ts` (lines 80-100):
```typescript
// If any item has medium or high severity, trigger follow-up notification
const hasUrgent = parsed.data.items.some(
  (i) => i.severity === "medium" || i.severity === "high"
);

if (hasUrgent) {
  const findings = parsed.data.items
    .filter((i) => i.severity === "medium" || i.severity === "high")
    .map((i) => `${i.category}: ${i.description} (${i.severity})`)
    .join("; ");

  const notificationResults = await Promise.allSettled([
    notifyObservationFollowUp(
      {
        name: booking.contactName,
        email: booking.contactEmail,
        phone: booking.contactPhone,
      },
      findings
    ),
  ]);
```
The upsell integration point is inside this `if (hasUrgent)` block. Generate upsell links from the filtered medium/high items, then pass them alongside the existing `findings` string.

**Notification hub** -- `lib/notifications/index.ts` (line 8):
```typescript
import {
  sendObservationFollowUpSMS,
  // ...
} from "./sms";
```
The `notifyObservationFollowUp` function orchestrates email + SMS. Add an optional `upsellLinks` param to both.

**Booking form URL pattern** -- `components/booking/booking-form.tsx` (lines 37-38):
```typescript
const searchParams = useSearchParams();
const preselectedSlug = searchParams.get("service");
```
The booking form already reads a `service` query param for pre-selection. The deep link format should use this existing parameter.

### Exact Implementation -- observation-upsell.ts

```typescript
// server/api/lib/observation-upsell.ts

const OBSERVATION_TO_MECHANIC_SERVICE: Record<string, string> = {
  "Brakes": "brake-service",
  "Battery": "battery-replace",
  "Belts": "belt-replacement",
  "AC/Cooling": "ac-repair",
  "Engine": "general-maintenance",
  "Fluids": "oil-change",
};

interface ObservationItem {
  category: string;
  severity: string;
  description: string;
}

interface VehicleInfo {
  year?: string;
  make?: string;
  model?: string;
}

interface UpsellLink {
  category: string;
  serviceSlug: string;
  deepLink: string;
}

export function getUpsellLinks(
  items: ObservationItem[],
  vehicleInfo: VehicleInfo | null,
  baseUrl: string,
): UpsellLink[] {
  const links: UpsellLink[] = [];

  for (const item of items) {
    if (item.severity !== "medium" && item.severity !== "high") continue;

    const serviceSlug = OBSERVATION_TO_MECHANIC_SERVICE[item.category];
    if (!serviceSlug) continue;

    const params = new URLSearchParams({ service: serviceSlug });
    if (vehicleInfo?.year) params.set("vehicleYear", vehicleInfo.year);
    if (vehicleInfo?.make) params.set("vehicleMake", vehicleInfo.make);
    if (vehicleInfo?.model) params.set("vehicleModel", vehicleInfo.model);

    links.push({
      category: item.category,
      serviceSlug,
      deepLink: `${baseUrl}/book?${params.toString()}`,
    });
  }

  return links;
}
```

### Project Structure Notes

**Files to CREATE:**

| File | Purpose |
|---|---|
| `server/api/lib/observation-upsell.ts` | Hardcoded category-to-service mapping and deep link generator |

**Files to MODIFY:**

| File | What to Change |
|---|---|
| `server/api/routes/observations.ts` | Call `getUpsellLinks()` in the `hasUrgent` block, pass results to notification |
| `lib/notifications/index.ts` | Add optional `upsellLinks` param to `notifyObservationFollowUp()` |
| `lib/notifications/email.ts` | Add upsell CTA section to observation follow-up email template |
| `lib/notifications/sms.ts` | Append first upsell link to observation follow-up SMS text |

**Files NOT to create:**
- NO `db/schema/observation-upsell.ts` -- hardcoded map, not a DB table
- NO migration files -- no schema changes
- NO new route files -- modifies existing observations handler

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a DB table for the category mapping | Use hardcoded `Record<string, string>` map |
| Generate links for low-severity items | Filter to `medium` and `high` only |
| Include all upsell links in SMS | Include only the first link (SMS length) |
| Use try-catch in the handler | Let Hono handle errors |
| Import from `"zod"` | Import from `"zod/v4"` if Zod is needed |

### Dependencies and Scope

**This story depends on:** Epic 16 (mechanic services seeded with correct slugs)

**This story does NOT include:**
- Tracking upsell conversion (whether customer actually books) -- post-beta analytics
- Multiple upsell links per SMS -- SMS length constraint, include only the first
- Admin UI for editing the category map -- hardcoded for beta

### Testing Guidance

Verify manually:
1. Submit observation with `{ category: "Brakes", severity: "medium" }` -- follow-up SMS/email should include link to `/book?service=brake-service`
2. Submit observation with `{ category: "Brakes", severity: "low" }` -- no upsell link in notification
3. Submit observation with `{ category: "Cosmetic", severity: "high" }` -- no upsell link (unmapped category)
4. Submit observation with vehicle info -- upsell link includes `vehicleYear`, `vehicleMake`, `vehicleModel` params
5. Existing follow-up notification behavior still works when no categories match

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 7: Observation to Mechanic Upsell Mapping]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-4.1, FR-4.2, FR-4.3]
- [Source: server/api/routes/observations.ts - Existing observation handler with follow-up logic]
- [Source: lib/notifications/index.ts - Existing notification orchestration]
- [Source: components/booking/booking-form.tsx - Existing service query param pre-selection]
