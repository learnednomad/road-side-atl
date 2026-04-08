# Story 16.4: Create Beta Helper and Trust Tier Bypass

Status: backlog

## Story

As a platform operator,
I want a beta mode helper that checks whether the open beta is active and bypasses trust tier restrictions during beta,
so that all users can access all payment methods during the beta period without permanent security changes.

## Acceptance Criteria

1. **Beta Helper** - Given `server/api/lib/beta.ts` is created, when `isBetaActive()` is called, then it reads the `beta_mode_active` key from `platform_settings` and returns `true` if the value is `"true"`, otherwise `false`.

2. **60-Second Cache** - Given `isBetaActive()` was called within the last 60 seconds, when called again, then it returns the cached value without hitting the database.

3. **Trust Tier Bypass** - Given beta mode is active and a Tier 1 user checks allowed payment methods, when `getAllowedPaymentMethods()` is called, then it returns all payment methods (Tier 2 equivalent: `["cash", "cashapp", "zelle", "stripe"]`).

4. **Audit Logging** - Given the trust tier bypass is triggered for a Tier 1 user during beta, when the bypass occurs, then an audit log entry is created with action `"beta_trust_bypass"` and the userId.

5. **Rollback Safety** - Given an admin sets `beta_mode_active` to `"false"` in platform_settings, when `isBetaActive()` cache expires (within 60s), then `getAllowedPaymentMethods()` reverts to standard tier-based logic with zero code changes.

## Tasks / Subtasks

- [ ] Task 1: Create beta helper (AC: #1, #2)
  - [ ] 1.1 Create `server/api/lib/beta.ts`
  - [ ] 1.2 Implement `isBetaActive()` with 60-second in-memory cache
  - [ ] 1.3 Export `isBetaActive` and a `clearBetaCache()` function for testing

- [ ] Task 2: Add beta_trust_bypass audit action (AC: #4)
  - [ ] 2.1 Add `"beta_trust_bypass"` to the `AuditAction` type union in `server/api/lib/audit-logger.ts`

- [ ] Task 3: Modify getAllowedPaymentMethods (AC: #3, #4, #5)
  - [ ] 3.1 Change `getAllowedPaymentMethods()` in `server/api/lib/trust-tier.ts` to accept `userId` parameter
  - [ ] 3.2 Add `isBetaActive()` check — if active and user is Tier 1, return Tier 2 methods
  - [ ] 3.3 Log `beta_trust_bypass` audit entry when bypass triggers
  - [ ] 3.4 Update all callers of `getAllowedPaymentMethods()` to pass userId

- [ ] Task 4: TypeScript verification (AC: #1-#5)
  - [ ] 4.1 Run `npx tsc --noEmit` to verify TypeScript compiles cleanly

## Dev Notes

### Critical Architecture Constraints

**The trust tier bypass is a RUNTIME check, not a schema change.** When beta ends, the original trust-tier logic resumes with zero code changes — just a `platform_settings` row update. This is the most architecturally critical constraint.

**Every beta bypass MUST be audit-logged.** No exceptions. The audit trail proves that bypasses only occurred during the beta window.

**`getAllowedPaymentMethods()` becomes async.** It currently returns synchronously. After this change, it must be `async` because `isBetaActive()` is async (DB read). All callers must be updated to `await`.

**Cache invalidation is time-based only.** No explicit invalidation on settings change. The 60-second TTL is acceptable because beta toggle is an infrequent admin action, and a 60-second delay is harmless.

### Existing Code You MUST Understand

**Current `getAllowedPaymentMethods()`** — `server/api/lib/trust-tier.ts` (lines 9-11):
```typescript
export function getAllowedPaymentMethods(trustTier: number): readonly string[] {
  return trustTier >= 2 ? TIER_2_ALLOWED_METHODS : TIER_1_ALLOWED_METHODS;
}
```

**Constants** — imported from `@/lib/constants`:
```typescript
TIER_1_ALLOWED_METHODS  // ["cash", "cashapp", "zelle"]
TIER_2_ALLOWED_METHODS  // ["cash", "cashapp", "zelle", "stripe"]
```

**Platform settings table** — `db/schema/platform-settings.ts`:
```typescript
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Audit log usage pattern** (from existing code):
```typescript
logAudit({
  action: "beta_trust_bypass",
  userId,
  resourceType: "user",
  resourceId: userId,
  details: { trustTier, bypassedTo: "tier_2" },
});
```

### Exact Implementation Specifications

**1. `server/api/lib/beta.ts` (new file):**

```typescript
import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

let cachedBetaActive: boolean | null = null;
let cacheExpiry = 0;

export async function isBetaActive(): Promise<boolean> {
  if (cachedBetaActive !== null && Date.now() < cacheExpiry) return cachedBetaActive;
  const setting = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "beta_mode_active"),
  });
  cachedBetaActive = setting?.value === "true";
  cacheExpiry = Date.now() + 60_000;
  return cachedBetaActive;
}

export function clearBetaCache(): void {
  cachedBetaActive = null;
  cacheExpiry = 0;
}
```

**2. Modified `getAllowedPaymentMethods()`** — `server/api/lib/trust-tier.ts`:

Change the function from sync to async, add beta check:
```typescript
export async function getAllowedPaymentMethods(trustTier: number, userId?: string): Promise<readonly string[]> {
  if (trustTier < 2 && userId) {
    const { isBetaActive } = await import("@/server/api/lib/beta");
    if (await isBetaActive()) {
      logAudit({
        action: "beta_trust_bypass",
        userId,
        resourceType: "user",
        resourceId: userId,
        details: { originalTier: trustTier, bypassedTo: "tier_2" },
      });
      return TIER_2_ALLOWED_METHODS;
    }
  }
  return trustTier >= 2 ? TIER_2_ALLOWED_METHODS : TIER_1_ALLOWED_METHODS;
}
```

Note: Dynamic import of `beta.ts` avoids circular dependency issues. The audit log is fire-and-forget since `logAudit()` already buffers writes.

**3. Audit action addition** — add to `AuditAction` type in `server/api/lib/audit-logger.ts`:
```typescript
| "beta_trust_bypass"
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Store beta state in environment variables | Use `platform_settings` table — admin-toggleable at runtime |
| Create middleware for beta check | Beta check is a library function called by specific logic |
| Remove the non-beta path from `getAllowedPaymentMethods` | Keep both paths — beta is temporary |
| Skip audit logging for the bypass | Log EVERY bypass with userId |
| Use static import for beta.ts in trust-tier.ts | Use dynamic import to avoid circular dependency |
| Add a cache invalidation endpoint | 60-second TTL is sufficient |
| Check `beta_start_date`/`beta_end_date` in `isBetaActive()` | Only check `beta_mode_active` — admin controls the toggle |

### Dependencies and Scope

**Depends on:** Story 16.1 (platform_settings must have beta rows — but the helper works even without them, returning `false`)

**This story blocks:** Story 16.6 (beta status endpoint uses `isBetaActive()`), Story 17.1 (booking flow may call `getAllowedPaymentMethods()`)

**This story does NOT include:**
- Beta status API endpoint (Story 16.6)
- Auto-enrollment in beta_users (Story 16.6)
- Admin beta toggle UI (Story 16.7)
- Booking flow changes (Epic 17)

### Testing Guidance

No test framework is installed. Verify manually:
1. Set `beta_mode_active` to `"true"` in platform_settings
2. Call `getAllowedPaymentMethods(1, "some-user-id")` — returns all 4 methods
3. Set `beta_mode_active` to `"false"`, wait 60s (or call `clearBetaCache()`)
4. Call again — returns only Tier 1 methods
5. Check audit_logs table — `beta_trust_bypass` entries exist
6. `npx tsc --noEmit` compiles without errors

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 16, Story 16.4]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 3: Beta Mode via Platform Settings]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 4: Trust Tier Beta Bypass]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-2.2, FR-2.3]
- [Source: server/api/lib/trust-tier.ts — Current getAllowedPaymentMethods() implementation]
- [Source: server/api/lib/audit-logger.ts — Audit action type union]
- [Source: db/schema/platform-settings.ts — Platform settings table]
