# Story 16.7: Admin Beta Toggle

Status: backlog

## Story

As an admin,
I want to toggle beta mode on/off from the admin dashboard and see beta participation stats,
so that I can control the beta lifecycle and monitor adoption without direct database access.

## Acceptance Criteria

1. **Beta Toggle API** - Given an admin calls `PATCH /api/admin/settings/beta` with `{ active: boolean }`, when processed, then the `beta_mode_active` row in `platform_settings` is updated to `"true"` or `"false"`, and the beta cache is cleared so the change takes effect immediately.

2. **Beta Stats API** - Given an admin calls `GET /api/admin/beta/stats`, when processed, then it returns `{ betaActive: boolean, betaUserCount: number, mechanicBookingCount: number, startDate: string | null, endDate: string | null }`.

3. **Admin Auth Required** - Given a non-admin user calls the beta toggle or stats endpoints, when processed, then a 403 Forbidden response is returned.

4. **Audit Logging** - Given an admin toggles beta mode, when the toggle is processed, then an audit log entry is created with action `"settings.update"`, the admin's userId, and details including the old and new values.

5. **Admin UI Toggle** - Given the admin business settings page, when the admin views it, then a beta mode toggle switch is visible showing the current state, and toggling it calls the API and updates the UI.

6. **Admin Dashboard Stats** - Given the admin dashboard, when viewed, then beta user count and mechanic booking count are displayed as summary cards.

## Tasks / Subtasks

- [ ] Task 1: Add beta toggle endpoint (AC: #1, #3, #4)
  - [ ] 1.1 Add `PATCH /settings/beta` route to admin routes (in `server/api/routes/admin.ts` or a dedicated admin settings route)
  - [ ] 1.2 Validate request body with Zod: `{ active: z.boolean() }`
  - [ ] 1.3 Update `platform_settings` row where `key = "beta_mode_active"` with `value = active ? "true" : "false"` and `updatedAt = new Date()`
  - [ ] 1.4 Call `clearBetaCache()` from `server/api/lib/beta.ts` to invalidate the cache immediately
  - [ ] 1.5 Log audit entry with `action: "settings.update"` and details `{ setting: "beta_mode_active", oldValue, newValue }`
  - [ ] 1.6 Ensure admin auth middleware protects the route

- [ ] Task 2: Add beta stats endpoint (AC: #2, #3)
  - [ ] 2.1 Add `GET /beta/stats` route to admin routes
  - [ ] 2.2 Query `beta_users` count
  - [ ] 2.3 Query bookings count where service category is `mechanics`
  - [ ] 2.4 Read beta config from platform_settings
  - [ ] 2.5 Return aggregated stats object

- [ ] Task 3: Admin UI — beta toggle in settings (AC: #5)
  - [ ] 3.1 Add beta mode toggle switch to the admin business settings page
  - [ ] 3.2 Fetch current beta state on page load
  - [ ] 3.3 Call `PATCH /api/admin/settings/beta` on toggle
  - [ ] 3.4 Show success/error feedback

- [ ] Task 4: Admin UI — dashboard stats (AC: #6)
  - [ ] 4.1 Add beta stats cards to admin dashboard
  - [ ] 4.2 Fetch stats from `GET /api/admin/beta/stats`
  - [ ] 4.3 Display beta user count and mechanic booking count

- [ ] Task 5: TypeScript verification
  - [ ] 5.1 Run `npx tsc --noEmit` to verify TypeScript compiles cleanly

## Dev Notes

### Critical Architecture Constraints

**`clearBetaCache()` must be called after toggling.** The beta helper uses a 60-second in-memory cache. Without clearing it, the toggle takes up to 60 seconds to take effect. Import `clearBetaCache` from `server/api/lib/beta.ts`.

**Manual `updatedAt` on every update.** Drizzle does not auto-update timestamps. Always include `updatedAt: new Date()` in every `.update().set()` call.

**Admin routes are already auth-gated.** Check the existing admin route middleware pattern — the admin routes likely already have auth middleware applied at the router level. Verify before adding redundant auth checks.

**`settings.update` is an existing audit action.** Do NOT add a new audit action — use the existing `"settings.update"` action with details specifying which setting changed.

### Existing Code You MUST Understand

**Platform settings table** — `db/schema/platform-settings.ts`:
```typescript
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Beta cache clear** — `server/api/lib/beta.ts` (created in Story 16.4):
```typescript
export function clearBetaCache(): void {
  cachedBetaActive = null;
  cacheExpiry = 0;
}
```

**Audit log pattern** (from admin routes):
```typescript
const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
logAudit({
  action: "settings.update",
  userId: user.id,
  resourceType: "platform_settings",
  resourceId: "beta_mode_active",
  details: { setting: "beta_mode_active", oldValue: previousValue, newValue: newValue },
  ipAddress,
  userAgent,
});
```

**Existing admin dashboard pattern** — Check the admin dashboard page for how existing stats cards are rendered. Follow the same component pattern for beta stats.

**Beta users table** — `db/schema/beta-users.ts`:
```typescript
export const betaUsers = pgTable("beta_users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  enrolledAt: timestamp("enrolledAt", { mode: "date" }).defaultNow().notNull(),
  source: text("source").notNull(),
  convertedAt: timestamp("convertedAt", { mode: "date" }),
});
```

### Exact Implementation Specifications

**1. Beta toggle endpoint** (add to admin routes):

```typescript
// PATCH /settings/beta
app.patch("/settings/beta", async (c) => {
  const user = c.get("user");
  const { active } = z.object({ active: z.boolean() }).parse(await c.req.json());

  // Read old value for audit
  const oldSetting = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "beta_mode_active"),
  });
  const oldValue = oldSetting?.value ?? "false";
  const newValue = active ? "true" : "false";

  await db
    .update(platformSettings)
    .set({ value: newValue, updatedAt: new Date() })
    .where(eq(platformSettings.key, "beta_mode_active"));

  // Clear cache immediately
  const { clearBetaCache } = await import("@/server/api/lib/beta");
  clearBetaCache();

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "settings.update",
    userId: user.id,
    resourceType: "platform_settings",
    resourceId: "beta_mode_active",
    details: { setting: "beta_mode_active", oldValue, newValue },
    ipAddress,
    userAgent,
  });

  return c.json({ success: true, betaActive: active });
});
```

**2. Beta stats endpoint** (add to admin routes):

```typescript
// GET /beta/stats
app.get("/beta/stats", async (c) => {
  const [betaUserCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(betaUsers);

  const [mechanicBookingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(services.category, "mechanics"));

  const active = await isBetaActive();

  const settings = await db.query.platformSettings.findMany({
    where: inArray(platformSettings.key, ["beta_start_date", "beta_end_date"]),
  });
  const startDate = settings.find(s => s.key === "beta_start_date")?.value ?? null;
  const endDate = settings.find(s => s.key === "beta_end_date")?.value ?? null;

  return c.json({
    betaActive: active,
    betaUserCount: betaUserCount?.count ?? 0,
    mechanicBookingCount: mechanicBookingCount?.count ?? 0,
    startDate,
    endDate,
  });
});
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Forget to call `clearBetaCache()` after toggle | Always clear cache so change is immediate |
| Create a new audit action for beta toggle | Use existing `"settings.update"` action |
| Forget `updatedAt: new Date()` in the update | Always include manual updatedAt |
| Import from `"zod"` | Import from `"zod/v4"` |
| Add try-catch in route handlers | Let Hono handle errors |
| Skip reading old value before update | Read old value for audit trail |
| Create a separate route file for admin beta | Add to existing admin routes |

### Dependencies and Scope

**Depends on:** Story 16.2 (beta_users table), Story 16.4 (beta helper + `clearBetaCache()`), Story 16.6 (beta status endpoint for reference)

**This story does NOT include:**
- Beta auto-enrollment logic (Story 16.6)
- Trust tier bypass logic (Story 16.4)
- Mechanic booking flow (Epic 17)
- Post-beta conversion tracking

### Testing Guidance

No test framework is installed. Verify manually:
1. `GET /api/admin/beta/stats` — returns counts and beta state
2. `PATCH /api/admin/settings/beta` with `{ active: false }` — beta deactivated
3. `GET /api/beta/status` — returns `{ active: false, ... }` (immediate, not 60s delay)
4. `PATCH /api/admin/settings/beta` with `{ active: true }` — beta reactivated
5. Check audit_logs — `settings.update` entries with old/new values
6. Non-admin user calling either endpoint — 403 response
7. Admin dashboard shows beta stats cards
8. `npx tsc --noEmit` compiles without errors

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 16, Story 16.7]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-2.7, FR-2.8]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 3: Beta Mode via Platform Settings]
- [Source: server/api/lib/beta.ts — Beta helper with clearBetaCache() (Story 16.4)]
- [Source: server/api/lib/audit-logger.ts — Audit action types and logging pattern]
- [Source: db/schema/platform-settings.ts — Platform settings table]
- [Source: db/schema/beta-users.ts — Beta users table (Story 16.2)]
