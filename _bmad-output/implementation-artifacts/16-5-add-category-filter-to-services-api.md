# Story 16.5: Add Category Filter to Services API

Status: backlog

## Story

As a customer or mobile app,
I want to filter services by category and see scheduling mode information,
so that I can browse only mechanic services (or roadside, or diagnostics) and know which services require scheduling.

## Acceptance Criteria

1. **Category Filter** - Given the `GET /api/services` endpoint, when called with `?category=mechanics`, then only services with `category = "mechanics"` are returned. When called without the parameter, all active services are returned (existing behavior preserved).

2. **schedulingMode in Response** - Given any call to `GET /api/services`, when the response is returned, then each service object includes the `schedulingMode` field (this is automatic since `schedulingMode` is now a column — verify it appears in the response).

3. **Categories Endpoint** - Given a new `GET /api/services/categories` endpoint, when called, then it returns an array of `{ category: string, count: number }` objects showing each category and the count of active services in it.

4. **Invalid Category** - Given a request with `?category=invalid`, when the request is processed, then an empty array is returned (no error — the enum mismatch naturally returns no results).

5. **Zod Validation** - Given the category query parameter, when it is provided, then it is validated as a valid service category string using Zod.

## Tasks / Subtasks

- [ ] Task 1: Add category filter to GET /api/services (AC: #1, #2, #4, #5)
  - [ ] 1.1 Parse `category` query parameter from the request in `server/api/routes/services.ts`
  - [ ] 1.2 Add Zod validation for the category parameter (optional, one of `["roadside", "diagnostics", "mechanics"]`)
  - [ ] 1.3 Add conditional `where` clause: if `category` is provided, filter by `eq(services.category, category)`; otherwise use existing `eq(services.active, true)` filter
  - [ ] 1.4 Ensure both filters apply together: `and(eq(services.active, true), eq(services.category, category))`

- [ ] Task 2: Add categories endpoint (AC: #3)
  - [ ] 2.1 Add `GET /categories` route to `server/api/routes/services.ts`
  - [ ] 2.2 Query services grouped by category with count, filtered to active services only
  - [ ] 2.3 Return `[{ category: string, count: number }]`

- [ ] Task 3: Add validators (AC: #5)
  - [ ] 3.1 Add `serviceCategoryFilterSchema` to `lib/validators.ts` for the query parameter validation
  - [ ] 3.2 Import from `"zod/v4"` — never `"zod"`

- [ ] Task 4: TypeScript verification
  - [ ] 4.1 Run `npx tsc --noEmit` to verify TypeScript compiles cleanly

## Dev Notes

### Critical Architecture Constraints

**The current services route is minimal.** It has a single `GET /` that returns all active services ordered by name. This story extends it significantly.

**`schedulingMode` is already in the response.** Since the column was added to the schema in Story 16.1 and the route does `select()` (all columns), `schedulingMode` appears automatically. No explicit projection change needed — just verify.

**Zod v4 import.** Always `import { z } from "zod/v4"` — never `"zod"`.

**No try-catch in route handlers.** Hono handles errors globally.

### Existing Code You MUST Understand

**Current services route** — `server/api/routes/services.ts` (complete file):
```typescript
import { Hono } from "hono";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  const allServices = await db
    .select()
    .from(services)
    .where(eq(services.active, true))
    .orderBy(services.name);

  return c.json(allServices);
});

export default app;
```

**Existing validator pattern** — `lib/validators.ts`:
```typescript
import { z } from "zod/v4";
export const createProviderSchema = z.object({ ... });
```

**serviceCategoryEnum values** (after Story 16.1):
```typescript
export const serviceCategoryEnum = pgEnum("service_category", [
  "roadside",
  "diagnostics",
  "mechanics",
]);
```

### Exact Implementation Specifications

**1. Updated `server/api/routes/services.ts`:**

```typescript
import { Hono } from "hono";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod/v4";

const app = new Hono();

const categoryFilterSchema = z.object({
  category: z.enum(["roadside", "diagnostics", "mechanics"]).optional(),
});

app.get("/", async (c) => {
  const { category } = categoryFilterSchema.parse({
    category: c.req.query("category") || undefined,
  });

  const conditions = [eq(services.active, true)];
  if (category) {
    conditions.push(eq(services.category, category));
  }

  const allServices = await db
    .select()
    .from(services)
    .where(and(...conditions))
    .orderBy(services.name);

  return c.json(allServices);
});

app.get("/categories", async (c) => {
  const categories = await db
    .select({
      category: services.category,
      count: sql<number>`count(*)::int`,
    })
    .from(services)
    .where(eq(services.active, true))
    .groupBy(services.category);

  return c.json(categories);
});

export default app;
```

**2. Validator addition** — `lib/validators.ts` (optional, if you prefer centralizing):
```typescript
export const serviceCategoryFilterSchema = z.object({
  category: z.enum(["roadside", "diagnostics", "mechanics"]).optional(),
});
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Import from `"zod"` | Import from `"zod/v4"` |
| Add try-catch in route handlers | Let Hono handle errors |
| Return 400 for invalid category | Return empty array (or use Zod enum validation) |
| Create a separate route file for categories | Add to existing `services.ts` route file |
| Use raw SQL for the category filter | Use Drizzle's `eq()` with the enum column |
| Add authentication to these endpoints | Services are public — no auth required |

### Dependencies and Scope

**Depends on:** Story 16.1 (enum extension + schedulingMode column)

**This story blocks:** Mobile app services screen (needs category tabs), Story 16.6 (beta status may reference services)

**This story does NOT include:**
- Booking flow validation for scheduledAt (Story 17.1)
- Service CRUD operations (not in Epic 16 scope)
- Admin service management UI changes

### Testing Guidance

No test framework is installed. Verify manually:
1. `GET /api/services` — returns all active services (existing behavior unchanged)
2. `GET /api/services?category=mechanics` — returns only mechanic services
3. `GET /api/services?category=roadside` — returns only roadside services
4. `GET /api/services?category=invalid` — returns Zod validation error (400)
5. `GET /api/services/categories` — returns `[{ category: "roadside", count: 6 }, { category: "diagnostics", count: 2 }, { category: "mechanics", count: 6 }]` (counts depend on seed data)
6. Each service in response includes `schedulingMode` field
7. `npx tsc --noEmit` compiles without errors

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 16, Story 16.5]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-1.5, FR-1.6, FR-1.7]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 1: Service Category Enum Extension]
- [Source: server/api/routes/services.ts — Current services route implementation]
- [Source: db/schema/services.ts — Services table and enum definition]
