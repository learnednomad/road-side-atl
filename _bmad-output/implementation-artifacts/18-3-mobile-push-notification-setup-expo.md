# Story 18.3: Mobile Push Notification Setup (Expo)

Status: backlog

## Story

As a mobile app user,
I want the app to request push notification permission and register my device automatically,
so that I receive real-time notifications about bookings and job assignments on my phone.

## Acceptance Criteria

1. **Permission Request** - Given a user opens the mobile app for the first time after login, when the push setup initializes, then the app requests notification permission via `expo-notifications`, and stores the permission status locally in MMKV.

2. **Token Registration** - Given the user grants notification permission, when the Expo push token is obtained, then the app calls `POST /api/push/register-device` with `{ expoPushToken, platform }` (detecting iOS vs Android), and stores the token in MMKV for comparison on future launches.

3. **Token Refresh** - Given the app launches and a token is already stored in MMKV, when the current Expo push token differs from the stored one, then the app re-registers with the backend by calling `POST /api/push/register-device` with the new token.

4. **Logout Cleanup** - Given a user logs out, when the logout flow executes, then the app calls `DELETE /api/push/unregister-device` with the stored Expo push token, and clears the token from MMKV.

5. **Notification Tap Navigation** - Given the app receives a push notification with `data.url` (e.g., `/track/abc123`), when the user taps the notification, then the app navigates to the corresponding screen using Expo Router (e.g., booking detail or provider jobs).

6. **Background Notification** - Given the app is backgrounded or closed, when a push notification arrives, then the system notification tray shows the notification with the correct title and body.

## Tasks / Subtasks

- [ ] Task 1: Create push notification module (AC: #1, #2, #6)
  - [ ] 1.1 Create `src/lib/push.ts` in mobile repo
  - [ ] 1.2 Import and configure `expo-notifications` with Android channel setup
  - [ ] 1.3 Implement `requestPushPermission()` — requests permission, returns status
  - [ ] 1.4 Implement `registerForPushNotifications()` — gets Expo push token, calls backend
  - [ ] 1.5 Detect platform via `Platform.OS` for the `platform` field

- [ ] Task 2: MMKV token persistence (AC: #2, #3)
  - [ ] 2.1 Store registered push token in MMKV under key `push_token`
  - [ ] 2.2 Store permission status in MMKV under key `push_permission`
  - [ ] 2.3 On app launch, compare current token to stored token — re-register if different

- [ ] Task 3: Integrate with auth flow (AC: #1, #4)
  - [ ] 3.1 Call `registerForPushNotifications()` after successful login (in auth store or app layout)
  - [ ] 3.2 Call `unregisterPushToken()` during logout flow (before clearing auth tokens)
  - [ ] 3.3 Add API hooks: `useRegisterDevice` and `useUnregisterDevice` mutations

- [ ] Task 4: Notification tap handler (AC: #5)
  - [ ] 4.1 Set up `Notifications.addNotificationResponseReceivedListener`
  - [ ] 4.2 Extract `data.url` from notification response
  - [ ] 4.3 Use Expo Router `router.push()` to navigate to the URL path

- [ ] Task 5: Android notification channel (AC: #6)
  - [ ] 5.1 Create default notification channel: `Notifications.setNotificationChannelAsync("default", { name: "Default", importance: Notifications.AndroidImportance.MAX, sound: "default" })`

## Dev Notes

### MOBILE APP STORY

**This story is implemented in the mobile app repo:**
`~/WebstormProjects/roadside-atl-mobile` (GitHub: `learnednomad/roadside-atl-mobile`)

**Stack:** Expo SDK 54, React Native 0.81.5, TypeScript, NativeWind, React Query, Zustand, MMKV

### Critical Architecture Constraints

**API client location:** `src/lib/api/client.tsx` — axios instance with JWT auth, baseURL from `env.ts`. All API calls go through this client.

**Feature file pattern:** New files go in `src/lib/` for cross-cutting utilities (push is not feature-specific). API hooks for push go in a new `src/lib/push.ts` file since they are used globally, not tied to a single feature.

**MMKV for storage:** Use MMKV (not AsyncStorage) for storing push token and permission status. This follows the existing auth token storage pattern.

### Existing Code You MUST Understand

**Auth store pattern** — `src/features/auth/use-auth-store.ts`:
The auth store manages login/logout. Push registration should hook into the login success callback. Push unregistration should happen before token cleanup on logout.

**API client** — `src/lib/api/client.tsx`:
```typescript
export const client = axios.create({
  baseURL: `${Env.EXPO_PUBLIC_API_URL}/api`,
  headers: { "Content-Type": "application/json" },
});
// Interceptors attach JWT and handle 401
```

**Expo Router navigation** — `src/app/` directory:
File-based routing. Use `router.push("/track/[id]")` pattern for notification tap navigation.

### Exact Implementation Specifications

**1. Push module (`src/lib/push.ts`):**
```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { router } from "expo-router";
import { client } from "@/lib/api/client";
import { storage } from "@/lib/storage"; // MMKV instance

const PUSH_TOKEN_KEY = "push_token";
const PUSH_PERMISSION_KEY = "push_permission";

// Configure notification handler (shows notification when app is foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[Push] Must use physical device for push notifications");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  storage.set(PUSH_PERMISSION_KEY, finalStatus);

  if (finalStatus !== "granted") {
    return null;
  }

  // Android channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Check if token changed
  const storedToken = storage.getString(PUSH_TOKEN_KEY);
  if (storedToken !== token) {
    await client.post("/push/register-device", {
      expoPushToken: token,
      platform: Platform.OS, // "ios" | "android"
    });
    storage.set(PUSH_TOKEN_KEY, token);
  }

  return token;
}

export async function unregisterPushToken(): Promise<void> {
  const token = storage.getString(PUSH_TOKEN_KEY);
  if (token) {
    await client
      .delete("/push/unregister-device", { data: { expoPushToken: token } })
      .catch((err) => console.error("[Push] Unregister failed:", err));
    storage.delete(PUSH_TOKEN_KEY);
    storage.delete(PUSH_PERMISSION_KEY);
  }
}

export function setupNotificationTapHandler(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const url = response.notification.request.content.data?.url;
      if (url && typeof url === "string") {
        router.push(url as any);
      }
    }
  );
  return () => subscription.remove();
}
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Use AsyncStorage | Use MMKV (`storage` instance) |
| Create a Zustand store for push state | Use MMKV directly — push state is simple key-value |
| Block login on push registration failure | Fire-and-forget — login succeeds regardless |
| Register push token before auth is established | Register after login succeeds (JWT must be available) |
| Use `expo-notifications` in web | This is mobile-only; web uses existing VAPID/web-push |

### Dependencies and Scope

**Depends on:** Story 18.1 (backend endpoints must exist), Story 18.2 (backend must deliver via Expo)

**This story does NOT include:**
- Backend endpoint implementation (Story 18.1)
- Expo Push API dispatch logic (Story 18.2)
- Specific notification content — uses whatever the backend sends

### NPM Dependencies

Ensure these are installed in the mobile repo:
- `expo-notifications` (likely already present or needs `npx expo install expo-notifications`)
- `expo-device` (for `isDevice` check)

### Testing Guidance

1. Build on physical device (push does not work on simulator)
2. Login — confirm permission dialog appears
3. Grant permission — confirm token registered (check `device_tokens` table in backend DB)
4. Send a test push via Expo Push Tool (https://expo.dev/notifications)
5. Background the app — confirm notification shows in tray
6. Tap notification — confirm navigation to correct screen
7. Logout — confirm token removed from backend DB

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 18, Story 18.3]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-6.12, FR-6.13]
- [Source: roadside-atl-mobile/src/lib/api/client.tsx — API client pattern]
- [Source: roadside-atl-mobile/src/lib/location.ts — Existing background task pattern]
