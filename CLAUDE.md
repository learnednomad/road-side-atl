# RoadSide GA - Project Instructions

## Git Tagging Policy (MANDATORY)

**Every merge to `main` MUST be tagged before deployment.** This is non-negotiable.

### Tag Format
- Use semantic versioning with `v` prefix: `v1.0.0`
- Pre-release: `v1.0.0-rc.1`, `v1.0.0-beta.1`, `v1.0.0-alpha.1`
- Patch fixes: increment patch (`v1.0.1`), never delete or rewrite tags

### When to Tag
- **Before every deploy** — tag-then-deploy, never deploy-then-tag
- **On merge to main** — the merge commit gets the tag
- **Hotfixes** — tag immediately on hotfix merge (`vX.Y.Z+1`)

### How to Tag
Always use **annotated tags** (not lightweight):
```bash
git tag -a v1.0.0 -m "Release 1.0.0: brief description of what changed"
git push origin v1.0.0
```

### Version Bump Rules
- `MAJOR` (v2.0.0): breaking API changes, incompatible DB migrations, auth flow changes
- `MINOR` (v1.1.0): new features, new endpoints, new UI pages
- `PATCH` (v1.0.1): bug fixes, security patches, copy changes, dependency updates

### CI/CD Integration
- Tags matching `v*.*.*` (without pre-release suffix) trigger production deploy
- Tags matching `v*.*.*-rc.*` trigger staging deploy
- Never delete a tag after push — fix forward with a new patch version

### Pre-Deploy Checklist
Before tagging a release:
1. All tests pass (`npm test`)
2. Build succeeds (`npm run build`)
3. Lint has 0 errors (`npx eslint`)
4. TypeScript compiles (`npx tsc --noEmit`)
5. No uncommitted changes on the branch being tagged

## Branch Strategy
- `main` ← merges from `development` only (enforced by CI)
- Feature branches → `development` → `main`
- Hotfix branches → `main` directly (tag immediately after)

## Mobile Parity Policy (MANDATORY)

Every web feature MUST have a corresponding mobile implementation built at the same time.

- **Mobile repo**: `~/WebstormProjects/roadside-atl-mobile` (GitHub: `learnednomad/roadside-atl-mobile`)
- **Stack**: Expo SDK 54, React Native 0.81.5, TypeScript, NativeWind, React Query, Zustand, MMKV
- **API client**: `src/lib/api/client.tsx` — axios with JWT auth, baseURL from `env.ts`
- **Features**: `src/features/[name]/` with `api.ts` (React Query hooks) + screen files
- **Routes**: `src/app/` (Expo Router file-based routing)

When adding a new backend endpoint → add the React Query hook in mobile `api.ts`
When adding a new web page → add the corresponding mobile screen
When modifying an API response shape → update the mobile type + hook

## Notifications (Novu)

Self-hosted Novu (https://novu.roadsidega.com) is the notification hub + in-app
**Inbox**. See `docs/novu-notifications.md` for the full design.

- **Adapter**: `lib/notifications/novu.ts` — `triggerNovu(workflowId, to, payload, {transactionId})`,
  `syncSubscriber(...)`, `inboxSubscriberHash(...)`. Fire-and-forget, never throws,
  no-op unless `NOVU_ENABLED`. Triggers are wired centrally into the existing
  `lib/notifications/index.ts` composite functions + key webhook/route sites.
- **Workflows**: defined in `scripts/seed-novu-workflows.mjs` (source of truth, 35
  workflows). Seed/update: `npm run novu:seed` (idempotent; `PROMOTE_TO_PROD=true`
  publishes Dev→Prod; `CHANNELS_ACTIVE=true` activates email/SMS steps).
- **Subscriber ids**: customer = `user.id`, provider = `provider:<providerId>`,
  ops/admin = Novu Topic `admins[:tenantId]`. Always pass a stable `transactionId`
  (e.g. `${bookingId}:dispatched`) — `triggerNovu` uses it for idempotency.
- **Flags**: `NOVU_ENABLED` (master, on in dev+prod) lights up the in-app Inbox.
  `NOVU_OWNS_DELIVERY` (Phase 2) makes the legacy Resend/Twilio/push senders SKIP
  the events Novu covers so Novu delivers email/SMS too (no double-send). Both off
  → legacy delivers and Novu adds only the Inbox.
- **Inbox UI (web)**: `components/notifications/inbox-bell.tsx` (`<InboxBell/>`),
  mounted in the navbar (signed-in users) + the `(provider)` layout. It fetches
  `GET /api/novu/inbox-config` (auth) for the subscriberId + HMAC hash, then renders
  `@novu/react`'s `<Inbox>`. `NEXT_PUBLIC_NOVU_*` env vars are build-time.

**Mobile parity (REQUIRED):** the web Inbox needs a React Native counterpart in
`roadside-atl-mobile` — use `@novu/react-native` (or the headless hooks), fetch the
same `GET /api/novu/inbox-config` for the subscriberId + HMAC `subscriberHash`, and
point `backendUrl`/`socketUrl` at `novu-api`/`novu-ws.roadsidega.com`. No new
backend work needed — the endpoint already returns everything the client needs.

## Code Conventions
- All prices in cents (integer)
- Commission rates in basis points (10000 = 100%)
- Fire-and-forget notifications: `.catch((err) => { console.error("[Notifications] Failed:", err); })`
- DB IDs: text with `createId()` (cuid2-style)
