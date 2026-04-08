# Story 19.4: Referral System (Mobile)

Status: backlog

## Story

As a customer using the mobile app,
I want to view my referral code, share it with friends via the native share sheet, and see my referral credit balance,
so that I can earn credits by referring new users to the platform.

## Acceptance Criteria

1. **Referral Screen Accessible** - Given the user is authenticated, when they navigate to the referral screen, then they see their unique referral code, a share button, and their current credit balance.

2. **Referral Code Displayed** - Given the referral screen loads, when the `GET /api/referrals/me` response returns, then the user's referral code is prominently displayed in a copyable format.

3. **Native Share Works** - Given the user taps the "Share" button, when the native share sheet opens, then it contains a pre-formatted message with the referral link (e.g., "Join RoadSide GA and get a discount! Use my code: ABC123 — <referral_link>").

4. **Credit Balance Shown** - Given the user has earned referral credits, when the referral screen loads, then the credit balance is displayed in dollars (converted from cents) with the label "Available Credits".

5. **Referral Stats Visible** - Given the user has made referrals, when the referral screen loads, then the total referral count and credited referral count are displayed.

6. **Empty State** - Given the user has no referrals yet, when the referral screen loads, then a friendly empty state message is shown: "Share your code to start earning credits!" with the share button prominently visible.

7. **Deep Link Route** - Given the referral screen is created, when the user navigates to it, then it is accessible from the app navigation (tab bar or settings menu).

## Tasks / Subtasks

- [ ] Task 1: Create referrals API hooks (AC: #2, #4, #5)
  - [ ] 1.1 Create `src/features/referrals/api.ts`
  - [ ] 1.2 Add `useReferralInfo` query hook calling `GET /api/referrals/me` — returns `{ referralCode, referralLink, totalReferrals, creditedReferrals, creditBalance }`
  - [ ] 1.3 Add `useReferralBalance` query hook calling `GET /api/referrals/me/balance` — returns `{ balance }` (in cents)

- [ ] Task 2: Create referral screen (AC: #1, #2, #3, #4, #5, #6)
  - [ ] 2.1 Create `src/features/referrals/referrals-screen.tsx`
  - [ ] 2.2 Display referral code in a large, styled card with a "Copy" button (using `Clipboard` API)
  - [ ] 2.3 Display credit balance formatted as dollars: `$${(balance / 100).toFixed(2)}`
  - [ ] 2.4 Display stats: "X referrals (Y credited)"
  - [ ] 2.5 "Share" button triggers `Share.share()` from `react-native` with message containing referral link
  - [ ] 2.6 Show empty state when `totalReferrals === 0`

- [ ] Task 3: Create route file (AC: #7)
  - [ ] 3.1 Create `src/app/referrals.tsx` exporting the referrals screen
  - [ ] 3.2 Add navigation entry point (e.g., from profile/settings screen or bottom tab)

- [ ] Task 4: Loading and error states (AC: #1)
  - [ ] 4.1 Show `ActivityIndicator` while referral data loads
  - [ ] 4.2 Show error message if API call fails

## Dev Notes

### Target Repo

**This is a MOBILE APP story.** All work is in `~/WebstormProjects/roadside-atl-mobile`.

### Existing Code Context

**Backend referral endpoints** (`server/api/routes/referrals.ts` in main repo):

- `GET /api/referrals/me` — Returns `{ referralCode, referralLink, totalReferrals, creditedReferrals, creditBalance }`. Auto-generates referral code on first call if user doesn't have one.
- `GET /api/referrals/me/balance` — Returns `{ balance }` (integer, in cents).
- `POST /api/referrals/redeem` — Redeems credits against a booking (not needed for this story, but can be wired later).

**Backend imports referral helpers:**
```typescript
import { generateReferralCode, calculateCreditBalance, redeemReferralCredits } from "../lib/referral-credits";
import { REFERRAL_CREDIT_AMOUNT_CENTS } from "@/lib/constants";
```

**API client** (`src/lib/api/client.tsx`): Axios instance with JWT auth interceptor. All requests to `/api/referrals/*` will automatically include the Bearer token.

### Key Implementation Details

- Use `Share.share()` from `react-native` for native share sheet. The share message should include the referral link from the API response.
- Use `Clipboard.setStringAsync()` from `expo-clipboard` for the copy-to-clipboard functionality.
- Credit balance comes back in cents — convert to dollars for display: `$${(cents / 100).toFixed(2)}`.
- The `referralLink` from the API response is a web URL like `https://roadsidega.com/register?ref=ABC123`. This is appropriate for sharing.
- Follow the existing pattern in `src/features/bookings/api.ts` using `react-query-kit`'s `createQuery`.

### Mobile Conventions

- **Routing:** Expo Router file-based routing at `src/app/`
- **State:** React Query for server state, Zustand for local state
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **API hooks:** `react-query-kit` with `createQuery` / `createMutation`
- **Stack:** Expo SDK 54, React Native 0.81.5, TypeScript

### Dependencies

- Backend referral routes must be deployed (these already exist in the main repo)
- User must be authenticated to access referral endpoints

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 19, Story 19.4]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-6.9, FR-6.10]
- [Source: server/api/routes/referrals.ts — GET /me, GET /me/balance endpoints]
- [Source: roadside-atl-mobile/src/lib/api/client.tsx — axios client with JWT auth]
