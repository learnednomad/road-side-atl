# Story 18.6: Provider Observations (Mobile)

Status: backlog

## Story

As a provider using the mobile app,
I want to submit vehicle observations with photos after completing a service,
so that customers receive a detailed checklist of their vehicle's condition and potential issues are flagged for follow-up mechanic services.

## Acceptance Criteria

1. **Observation Form Access** - Given a provider has a job with status `in_progress` or `completed`, when they tap "Add Observations" on the job detail, then the observations form screen opens pre-populated with the booking ID.

2. **Checklist Items** - Given the observation form is open, when the provider adds observation items, then each item has: category (dropdown: Brakes, Battery, Belts, AC/Cooling, Engine, Fluids, Tires, Lights, Other), description (text input), severity (low/medium/high selector), and optional photo.

3. **Photo Capture** - Given the provider taps the camera icon on an observation item, when the camera opens via `expo-image-picker`, then the provider can take a photo or select from gallery, preview it, and attach it to the item. The photo is uploaded to the backend and the returned URL is included in the observation payload.

4. **Submission** - Given the provider has at least one observation item filled out, when they tap "Submit Observations", then the app POSTs to `/api/observations` with `{ bookingId, items: [{ category, description, severity, photoUrl? }] }`, and on success shows a confirmation and navigates back.

5. **Validation** - Given the provider submits the form, when any required field is missing (category, description, severity), then inline validation errors are shown and submission is blocked.

6. **Duplicate Prevention** - Given the provider has already submitted observations for a booking, when they try to submit again, then the backend returns 409 and the app shows "Observations already submitted for this booking."

7. **Offline Resilience** - Given the provider loses network during submission, when the POST fails, then the form data is preserved (not cleared) and the provider can retry.

## Tasks / Subtasks

- [ ] Task 1: Create observations screen (AC: #1, #2)
  - [ ] 1.1 Create `src/features/provider/observations-screen.tsx`
  - [ ] 1.2 Accept `bookingId` as route param or prop
  - [ ] 1.3 Build checklist UI with category dropdown, description input, severity selector
  - [ ] 1.4 Allow adding/removing multiple observation items (min 1)

- [ ] Task 2: Photo capture integration (AC: #3)
  - [ ] 2.1 Install/verify `expo-image-picker` is available
  - [ ] 2.2 Implement camera capture and gallery selection
  - [ ] 2.3 Show photo preview thumbnail after capture
  - [ ] 2.4 Upload photo to backend (e.g., `POST /api/upload` or S3 presigned URL) and get URL back

- [ ] Task 3: Add API hooks (AC: #4)
  - [ ] 3.1 Add `useSubmitObservation` mutation to `src/features/provider/api.ts`
  - [ ] 3.2 Mutation calls `POST /api/observations` with observation payload
  - [ ] 3.3 On success: invalidate relevant queries, show success toast/alert, navigate back

- [ ] Task 4: Form validation (AC: #5)
  - [ ] 4.1 Validate all items have category, description, and severity before submission
  - [ ] 4.2 Show inline error messages per field
  - [ ] 4.3 Disable submit button when validation fails

- [ ] Task 5: Error handling (AC: #6, #7)
  - [ ] 5.1 Handle 409 conflict response — show "already submitted" message
  - [ ] 5.2 Handle network errors — preserve form state, show retry option
  - [ ] 5.3 Handle 404 (booking not found) — show error and navigate back

- [ ] Task 6: Navigation wiring (AC: #1)
  - [ ] 6.1 Add "Add Observations" button to job detail view (from Story 18.4)
  - [ ] 6.2 Create route file `src/app/provider/observations.tsx` if using file-based routing
  - [ ] 6.3 Pass `bookingId` via route params

## Dev Notes

### MOBILE APP STORY

**This story is implemented in the mobile app repo:**
`~/WebstormProjects/roadside-atl-mobile` (GitHub: `learnednomad/roadside-atl-mobile`)

**Stack:** Expo SDK 54, React Native 0.81.5, TypeScript, NativeWind, React Query, Zustand, MMKV

### Critical Architecture Constraints

**Backend endpoint already exists.** `POST /api/observations` in `server/api/routes/observations.ts` validates with `createObservationSchema`, checks provider ownership of the booking, prevents duplicates (409), and triggers follow-up notifications.

**Photo upload path:** The existing platform uses S3 for file storage. Check if there is an existing upload endpoint. If not, photos can be uploaded as base64 in the payload or via a separate upload endpoint. The `photoUrl` field in the schema expects a URL string.

### Existing Code You MUST Understand

**Backend observation schema** — `lib/validators.ts`:
```typescript
export const createObservationSchema = z.object({
  bookingId: z.string().uuid("Invalid booking"),
  items: z.array(
    z.object({
      category: z.string().min(1, "Category is required"),
      description: z.string().min(1, "Description is required"),
      severity: z.enum(["low", "medium", "high"]),
      photoUrl: z.string().url().optional(),
    })
  ).min(1, "At least one observation item is required"),
});
```

**Backend observations route** — `server/api/routes/observations.ts`:
- Requires provider auth (`requireProvider` middleware)
- Validates booking belongs to the provider
- Returns 409 if observation already exists for booking
- Triggers observation follow-up notification on success

**API client** — `src/lib/api/client.tsx`:
```typescript
export const client = axios.create({
  baseURL: `${Env.EXPO_PUBLIC_API_URL}/api`,
});
```

### Exact Implementation Specifications

**1. Observation categories constant:**
```typescript
const OBSERVATION_CATEGORIES = [
  "Brakes",
  "Battery",
  "Belts",
  "AC/Cooling",
  "Engine",
  "Fluids",
  "Tires",
  "Lights",
  "Other",
] as const;

const SEVERITY_OPTIONS = [
  { label: "Low", value: "low", color: "text-green-600" },
  { label: "Medium", value: "medium", color: "text-amber-600" },
  { label: "High", value: "high", color: "text-red-600" },
] as const;
```

**2. API hook (`src/features/provider/api.ts`):**
```typescript
export type ObservationItem = {
  category: string;
  description: string;
  severity: "low" | "medium" | "high";
  photoUrl?: string;
};

export type CreateObservationInput = {
  bookingId: string;
  items: ObservationItem[];
};

export const useSubmitObservation = createMutation<
  void,
  CreateObservationInput,
  AxiosError
>({
  mutationFn: async (variables) => {
    await client.post("/observations", variables);
  },
});
```

**3. Photo capture pattern:**
```typescript
import * as ImagePicker from "expo-image-picker";

async function capturePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: true,
  });

  if (result.canceled) return null;

  const uri = result.assets[0].uri;
  // Upload to backend and return URL
  const formData = new FormData();
  formData.append("file", {
    uri,
    type: "image/jpeg",
    name: "observation.jpg",
  } as any);

  const { data } = await client.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data.url;
}
```

**4. Form state management:**
```typescript
type ObservationFormItem = {
  id: string; // local key for React list rendering
  category: string;
  description: string;
  severity: "low" | "medium" | "high" | "";
  photoUrl?: string;
};

const [items, setItems] = useState<ObservationFormItem[]>([
  { id: createId(), category: "", description: "", severity: "" },
]);
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Clear form on network error | Preserve form state for retry |
| Allow submission with zero items | Require at least one observation item |
| Skip photo compression | Use `quality: 0.7` in ImagePicker |
| Upload photos synchronously during form fill | Upload on capture, store URL |
| Create a new API route file | Use existing `POST /api/observations` |
| Use `expo-camera` directly | Use `expo-image-picker` (simpler, handles permissions) |

### Dependencies and Scope

**Depends on:** Story 18.4 (job detail must have navigation to observations form)

**This story does NOT include:**
- Backend observation endpoint changes (already exists)
- Observation-to-mechanic upsell logic (backend already handles in follow-up)
- Admin view of observations (already exists in web admin)

### NPM Dependencies

Ensure installed in mobile repo:
- `expo-image-picker` (`npx expo install expo-image-picker`)

### Testing Guidance

1. Login as provider on mobile
2. Accept and start a job (status = `in_progress`)
3. Tap "Add Observations" on the job
4. Add multiple items with different categories and severities
5. Capture a photo for one item
6. Submit — confirm success message and observation visible in admin
7. Try to submit again for same booking — confirm 409 error handled
8. Kill network before submit — confirm form data preserved, retry works

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 18, Story 18.6]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-6.7]
- [Source: lib/validators.ts — createObservationSchema]
- [Source: server/api/routes/observations.ts — Backend observation route]
- [Source: roadside-atl-mobile/src/features/provider/api.ts — Existing provider API hooks]
