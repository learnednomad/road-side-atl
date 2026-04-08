# Story 18.1: Device Token Table and Registration Endpoints

Status: backlog

## Story

As a mobile app user,
I want to register my device for push notifications when I log in,
so that I receive real-time updates about my bookings and jobs on my phone.

## Acceptance Criteria

1. **Schema Migration** - Given the database exists, when the migration runs, then a `device_tokens` table is created with columns: `id` (text PK, cuid2), `userId` (text FK to users, cascade delete), `expoPushToken` (text, not null), `platform` (text, not null — `"ios"` | `"android"`), `createdAt` (timestamp, defaultNow), `updatedAt` (timestamp, defaultNow), and a unique constraint on `expoPushToken`.

2. **Register Device Token** - Given an authenticated user, when they POST to `/api/push/register-device` with `{ expoPushToken, platform }`, then the token is validated against the Expo format (`ExponentPushToken[...]`), stored in `device_tokens` linked to their userId, and returns `{ success: true }`. If the token already exists for the same user, it updates `updatedAt`. If the token exists for a different user, it reassigns to the current user.

3. **Unregister Device Token** - Given an authenticated user, when they DELETE `/api/push/unregister-device` with `{ expoPushToken }`, then the matching token row is deleted for that user, and returns `{ success: true }`. If no matching token exists, it still returns success (idempotent).

4. **Token Format Validation** - Given a registration request, when the `expoPushToken` does not match the pattern `ExponentPushToken[...]` or `ExpoPushToken[...]`, then the endpoint returns 400 with `{ error: "Invalid Expo push token format" }`.

5. **Auth Required** - Given an unauthenticated request, when hitting either endpoint, then a 401 is returned.

## Tasks / Subtasks

- [ ] Task 1: Create device tokens schema (AC: #1)
  - [ ] 1.1 Create `db/schema/device-tokens.ts` with `deviceTokens` table definition
  - [ ] 1.2 Export `deviceTokens` from `db/schema/index.ts`
  - [ ] 1.3 Run `npm run db:generate` to create migration
  - [ ] 1.4 Verify migration SQL creates table with correct columns and constraints

- [ ] Task 2: Add Zod validation schema (AC: #4)
  - [ ] 2.1 Add `registerDeviceSchema` to `lib/validators.ts` with Expo token regex validation
  - [ ] 2.2 Add `unregisterDeviceSchema` to `lib/validators.ts`

- [ ] Task 3: Add registration endpoint (AC: #2, #5)
  - [ ] 3.1 Add `POST /register-device` route to `server/api/routes/push.ts`
  - [ ] 3.2 Use `requireAuth` middleware
  - [ ] 3.3 Validate request body with `registerDeviceSchema`
  - [ ] 3.4 Upsert logic: insert or update on conflict (same token)

- [ ] Task 4: Add unregister endpoint (AC: #3, #5)
  - [ ] 4.1 Add `DELETE /unregister-device` route to `server/api/routes/push.ts` (or POST for mobile compatibility)
  - [ ] 4.2 Use `requireAuth` middleware
  - [ ] 4.3 Delete matching token for current user (idempotent)

- [ ] Task 5: Add device status to push status endpoint (AC: #2)
  - [ ] 5.1 Extend existing `GET /status` to include `deviceTokenCount` alongside `subscriptionCount`

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** The push notification system already exists for web (VAPID/web-push). This story adds a parallel device token system for mobile (Expo Push). The two systems are separate tables — `push_subscriptions` (web) and `device_tokens` (mobile).

**Do NOT modify the existing `push_subscriptions` table.** The architecture decision (Decision 6 in `architecture.md`) explicitly chose a new table over extending the existing one because the payload shapes differ (Expo token is a string vs web-push subscription is a JSON object with endpoint + keys).

### Existing Code You MUST Understand

**Push subscriptions schema** — `db/schema/push-subscriptions.ts`:
```typescript
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});
```

**Existing push routes** — `server/api/routes/push.ts`:
Routes use `requireAuth` middleware for auth. Follow the same Hono pattern for new endpoints. The file already has `subscribe`, `unsubscribe`, `status`, and `resubscribe` routes for web push.

**ID generation** — `db/schema/utils.ts`:
```typescript
export function createId(): string {
  return crypto.randomUUID();
}
```

**Validator pattern** — `lib/validators.ts`:
```typescript
import { z } from "zod/v4";  // NEVER "zod"
```

### Exact Implementation Specifications

**1. Schema (`db/schema/device-tokens.ts`):**
```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { users } from "./users";

export const deviceTokens = pgTable("device_tokens", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expoPushToken: text("expo_push_token").notNull().unique(),
  platform: text("platform").notNull(), // "ios" | "android"
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});
```

**2. Validation (`lib/validators.ts`):**
```typescript
const expoPushTokenRegex = /^Expo(nent)?PushToken\[.+\]$/;

export const registerDeviceSchema = z.object({
  expoPushToken: z.string().regex(expoPushTokenRegex, "Invalid Expo push token format"),
  platform: z.enum(["ios", "android"]),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const unregisterDeviceSchema = z.object({
  expoPushToken: z.string().min(1, "Token is required"),
});
export type UnregisterDeviceInput = z.infer<typeof unregisterDeviceSchema>;
```

**3. Registration route pattern:**
```typescript
app.post("/register-device", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = registerDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid Expo push token format" }, 400);
  }
  // Upsert: if token exists, update userId + updatedAt
  // If token is new, insert
});
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Add columns to `push_subscriptions` | Create new `device_tokens` table |
| Use lightweight tokens without format validation | Validate `ExponentPushToken[...]` regex |
| Skip cascade delete on userId FK | Include `onDelete: "cascade"` |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports | Use `@/` path alias |

### Dependencies and Scope

**This story blocks:** Story 18.2 (Dual-Channel Dispatch), Story 18.3 (Mobile Push Setup)

**This story does NOT include:**
- Sending push notifications via Expo (Story 18.2)
- Mobile app token registration logic (Story 18.3)
- Any modification to the existing web-push flow

### Testing Guidance

No test framework is installed. Verify manually:
1. Run migration — confirm `device_tokens` table created
2. POST valid Expo token — confirm row inserted
3. POST same token again — confirm `updatedAt` updated, no duplicate
4. POST invalid token format — confirm 400 returned
5. DELETE token — confirm row removed
6. GET `/status` — confirm `deviceTokenCount` included

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 18, Story 18.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 6: Push Notification Dual-Channel Architecture]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-5.1, FR-5.2]
- [Source: db/schema/push-subscriptions.ts — Existing web push schema pattern]
- [Source: server/api/routes/push.ts — Existing push route patterns]
- [Source: lib/validators.ts — Zod v4 validation pattern]
