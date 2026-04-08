# Story 18.2: Dual-Channel Push Notification Dispatch

Status: backlog

## Story

As a platform operator,
I want push notifications to be delivered to both web browsers and mobile devices automatically,
so that users receive real-time updates regardless of which client they are using.

## Acceptance Criteria

1. **Dual-Channel Dispatch** - Given a user has both a web push subscription and a registered Expo device token, when a push notification is triggered (e.g., booking status change), then the notification is sent to both the web browser via VAPID/web-push AND to the mobile device via Expo Push API, with independent success/failure tracking.

2. **Expo Push API Integration** - Given one or more Expo push tokens exist for a user, when `sendPushNotification()` is called, then an HTTP POST is sent to `https://exp.host/--/api/v2/push/send` with the tokens and payload formatted per Expo's API spec, and delivery is fire-and-forget with error logging.

3. **Invalid Token Cleanup** - Given an Expo push token returns a `DeviceNotRegistered` error from the Expo Push API, when the response is processed, then the invalid token is deleted from `device_tokens`.

4. **Batch Support** - Given a user has multiple device tokens, when a push is sent, then all tokens are included in a single batch request to the Expo Push API (up to 100 per batch per Expo limits).

5. **Provider Job Notification** - Given a provider has registered device tokens, when a job is assigned to them (dispatched), then they receive a mobile push notification with job details (service name, customer name, address).

6. **Backward Compatibility** - Given the existing web-push flow works, when the Expo push channel is added, then existing web-push behavior is completely unchanged.

## Tasks / Subtasks

- [ ] Task 1: Create Expo Push API client (AC: #2, #4)
  - [ ] 1.1 Create `sendExpoPush(tokens: string[], payload: PushPayload)` function in `lib/notifications/push.ts`
  - [ ] 1.2 HTTP POST to `https://exp.host/--/api/v2/push/send` with batch message array
  - [ ] 1.3 Format payload: `{ to, title, body, data, sound, badge }`
  - [ ] 1.4 Fire-and-forget with `console.error("[Push] Expo push failed:", err)` pattern

- [ ] Task 2: Add device token query helper (AC: #1)
  - [ ] 2.1 Create `getDeviceTokens(userId: string)` function that queries `device_tokens` table
  - [ ] 2.2 Import `deviceTokens` schema in `lib/notifications/push.ts`

- [ ] Task 3: Extend `sendPushNotification()` (AC: #1, #6)
  - [ ] 3.1 After existing web-push loop, query `device_tokens` for the user
  - [ ] 3.2 If tokens exist, call `sendExpoPush()` with all token strings
  - [ ] 3.3 Add Expo results to return value `{ sent, failed }` (combine web + mobile counts)
  - [ ] 3.4 Ensure existing web-push code path is unmodified

- [ ] Task 4: Handle invalid token cleanup (AC: #3)
  - [ ] 4.1 Parse Expo Push API response for `DeviceNotRegistered` status
  - [ ] 4.2 Delete matching tokens from `device_tokens` table
  - [ ] 4.3 Log cleanup: `console.error("[Push] Removed invalid Expo token:", token)`

- [ ] Task 5: Verify provider notifications (AC: #5)
  - [ ] 5.1 Confirm `notifyProviderNewJobPush()` already calls `sendPushNotification()` with provider's userId
  - [ ] 5.2 No code change needed if provider userId resolution is already correct (it is — see existing code)

## Dev Notes

### Critical Architecture Constraints

**Fire-and-forget pattern is mandatory.** All push notification delivery uses `.catch(err => console.error(...))` — never await, never retry, never throw. This matches the existing notification pattern throughout the codebase.

**Expo Push API is stateless HTTP.** No webhooks, no SDK needed. Simple `fetch` POST to `https://exp.host/--/api/v2/push/send`. No API key required for sending (Expo tokens are self-authenticating).

### Existing Code You MUST Understand

**Current push dispatch** — `lib/notifications/push.ts`:
```typescript
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  // Queries push_subscriptions for web-push subscribers
  // Loops through each, sends via webpush.sendNotification()
  // Removes 410/404 subscriptions (expired)
  // Returns { sent, failed } counts
}
```

**Provider job notification** — `lib/notifications/push.ts`:
```typescript
export async function notifyProviderNewJobPush(
  providerId: string, bookingId: string,
  customerName: string, serviceName: string
): Promise<void> {
  // Resolves providerId → userId via providers table
  // Calls sendPushNotification(userId, payload)
}
```
This function already works for the mobile path because it calls `sendPushNotification()` which we are extending.

**Existing notification pattern** (from `lib/notifications/index.ts`):
```typescript
.catch((err) => { console.error("[Notifications] Failed:", err); })
```

### Exact Implementation Specifications

**1. Expo Push API call:**
```typescript
async function sendExpoPush(
  tokens: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const messages = tokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: { url: payload.url || "/", ...payload.data },
    sound: "default" as const,
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    let sent = 0;
    let failed = 0;

    if (result.data) {
      for (let i = 0; i < result.data.length; i++) {
        if (result.data[i].status === "ok") {
          sent++;
        } else {
          failed++;
          if (result.data[i].details?.error === "DeviceNotRegistered") {
            await db.delete(deviceTokens)
              .where(eq(deviceTokens.expoPushToken, tokens[i]))
              .catch((err) => console.error("[Push] Failed to remove invalid token:", err));
          }
        }
      }
    }

    return { sent, failed };
  } catch (err) {
    console.error("[Push] Expo push failed:", err);
    return { sent: 0, failed: tokens.length };
  }
}
```

**2. Extended `sendPushNotification()`:**
Add after the existing web-push loop, before the `return { sent, failed }`:
```typescript
// Expo push (mobile)
const mobileTokens = await db.query.deviceTokens.findMany({
  where: eq(deviceTokens.userId, userId),
});
if (mobileTokens.length > 0) {
  const expoResult = await sendExpoPush(
    mobileTokens.map((t) => t.expoPushToken),
    payload
  );
  sent += expoResult.sent;
  failed += expoResult.failed;
}
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Install `expo-server-sdk` npm package | Use raw `fetch` to Expo Push API |
| Await push delivery in request handlers | Fire-and-forget with `.catch()` |
| Retry failed push sends | Log and move on |
| Modify existing web-push code paths | Add Expo push code after web-push block |
| Create a separate notification file for Expo | Extend existing `lib/notifications/push.ts` |

### Dependencies and Scope

**Depends on:** Story 18.1 (device token table must exist)
**Blocks:** Story 18.3 (mobile push setup — needs backend to actually deliver)

**This story does NOT include:**
- Mobile app push registration (Story 18.3)
- New notification event types — uses existing triggers
- Web push modifications — existing behavior unchanged

### Testing Guidance

No test framework installed. Verify manually:
1. Register an Expo push token via Story 18.1 endpoints
2. Trigger a booking status change
3. Confirm Expo Push API is called (check server logs for `[Push]` entries)
4. Confirm web-push still works independently
5. Send to invalid token — confirm it gets cleaned up from `device_tokens`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 18, Story 18.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 6: Push Notification Dual-Channel Architecture]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-5.3, FR-5.4, FR-5.5]
- [Source: lib/notifications/push.ts — Existing web-push dispatch logic]
- [Source: server/api/routes/push.ts — Existing push route structure]
