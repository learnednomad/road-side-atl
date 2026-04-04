# Deferred Work

## Deferred from: code review of story 14-2 (2026-04-01)

- Hardcoded fallback URL `https://roadsideatl.com` repeated in 5+ notification functions — extract to shared constant in `lib/constants.ts`
- Extra DB round-trip in `notifyProviderRejected` — caller already has provider object, could pass it as argument instead of re-querying
- Dashboard auto-transition (onboarding.ts:62-104) doesn't call `onStripeConnectStepComplete` for suspended-provider reactivation — pre-existing architecture gap
- `notifyDocumentReviewed` accepts arbitrary `status: string` — should be typed as `"approved" | "rejected"` for safety
- `notifyBackgroundCheckResult` silently returns on unknown Checkr statuses — consider logging or notifying admin for unrecognized statuses
