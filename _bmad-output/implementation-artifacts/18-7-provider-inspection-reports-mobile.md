# Story 18.7: Provider Inspection Reports (Mobile)

Status: backlog

## Story

As a provider using the mobile app,
I want to submit structured inspection reports with detailed findings and photos after a diagnostics or mechanics service,
so that customers receive a professional PDF report and potential issues are documented for follow-up.

## Acceptance Criteria

1. **Inspection Report Form Access** - Given a provider has a job with status `in_progress` or `completed` for a diagnostics or mechanics service, when they tap "Submit Inspection Report" on the job detail, then the inspection report form opens pre-populated with the booking ID.

2. **Structured Findings** - Given the inspection report form is open, when the provider adds findings, then each finding has: category (dropdown: Engine, Transmission, Brakes, Suspension, Electrical, Exhaust, Cooling, Steering, Body, Interior), component (text input), condition (good/fair/poor/critical selector), description (text input), optional measurement (text), optional OBD code (text), and optional photo.

3. **Photo Capture** - Given the provider taps the camera icon on a finding, when the camera opens via `expo-image-picker`, then the provider can capture or select a photo, preview it, and attach it to the finding. The photo is uploaded and the URL is included in the payload.

4. **Submission** - Given the provider has at least one finding filled out, when they tap "Submit Report", then the app POSTs to `/api/inspection-reports` with `{ bookingId, findings: [{ category, component, condition, description, measurement?, obdCode?, photoUrl? }] }`, and on success shows a confirmation message and navigates back.

5. **PDF Generation Trigger** - Given the inspection report is submitted successfully, when the backend processes it, then a PDF is generated server-side (existing backend logic) and the customer is notified.

6. **Validation** - Given the provider submits the form, when required fields are missing (category, component, condition, description), then inline validation errors are shown and submission is blocked.

7. **Duplicate Prevention** - Given the provider has already submitted an inspection report for a booking, when they try to submit again, then the backend returns 409 and the app shows "Inspection report already submitted for this booking."

8. **Condition Severity Indicator** - Given a finding has a condition of `poor` or `critical`, when displayed in the form, then the condition badge is styled in amber/red to visually indicate severity.

## Tasks / Subtasks

- [ ] Task 1: Create inspection report screen (AC: #1, #2)
  - [ ] 1.1 Create `src/features/provider/inspection-report-screen.tsx`
  - [ ] 1.2 Accept `bookingId` as route param
  - [ ] 1.3 Build structured findings form with category dropdown, component input, condition selector, description, measurement, OBD code fields
  - [ ] 1.4 Allow adding/removing multiple findings (min 1)
  - [ ] 1.5 Style condition badges with color coding (AC: #8)

- [ ] Task 2: Photo capture integration (AC: #3)
  - [ ] 2.1 Reuse photo capture pattern from Story 18.6 (observations)
  - [ ] 2.2 Show photo preview thumbnail per finding
  - [ ] 2.3 Upload photo and store URL

- [ ] Task 3: Add API hooks (AC: #4)
  - [ ] 3.1 Add `useSubmitInspectionReport` mutation to `src/features/provider/api.ts`
  - [ ] 3.2 Mutation calls `POST /api/inspection-reports` with findings payload
  - [ ] 3.3 On success: show confirmation, navigate back

- [ ] Task 4: Form validation (AC: #6)
  - [ ] 4.1 Validate all findings have category, component, condition, description
  - [ ] 4.2 Show inline error messages per field
  - [ ] 4.3 Disable submit when validation fails

- [ ] Task 5: Error handling (AC: #7)
  - [ ] 5.1 Handle 409 conflict — show "already submitted" message
  - [ ] 5.2 Handle network errors — preserve form, show retry
  - [ ] 5.3 Handle 404 — show error and navigate back

- [ ] Task 6: Navigation wiring (AC: #1)
  - [ ] 6.1 Add "Submit Inspection Report" button to job detail (from Story 18.4)
  - [ ] 6.2 Create route file `src/app/provider/inspection-report.tsx` if using file-based routing
  - [ ] 6.3 Pass `bookingId` via route params
  - [ ] 6.4 Only show button for diagnostics/mechanics service categories

## Dev Notes

### MOBILE APP STORY

**This story is implemented in the mobile app repo:**
`~/WebstormProjects/roadside-atl-mobile` (GitHub: `learnednomad/roadside-atl-mobile`)

**Stack:** Expo SDK 54, React Native 0.81.5, TypeScript, NativeWind, React Query, Zustand, MMKV

### Critical Architecture Constraints

**Backend endpoint already exists.** `POST /api/inspection-reports` in `server/api/routes/inspection-reports.ts` validates with `createInspectionReportSchema`, checks provider ownership, prevents duplicates (409), generates a PDF via `generateInspectionPDF()`, and sends customer notification.

**PDF generation is server-side.** The mobile app only submits the findings data. The backend handles PDF generation and notification. No PDF logic is needed in the mobile app.

**This form is more complex than observations.** Inspection reports have more fields per finding (7 vs 4). Use a scrollable form with collapsible finding sections for better UX on small screens.

### Existing Code You MUST Understand

**Backend inspection report schema** — `lib/validators.ts`:
```typescript
export const createInspectionReportSchema = z.object({
  bookingId: z.string().uuid("Invalid booking"),
  findings: z.array(
    z.object({
      category: z.string().min(1, "Category is required"),
      component: z.string().min(1, "Component is required"),
      condition: z.enum(["good", "fair", "poor", "critical"]),
      description: z.string().min(1, "Description is required"),
      measurement: z.string().optional(),
      photoUrl: z.string().url().optional(),
      obdCode: z.string().optional(),
    })
  ).min(1, "At least one finding is required"),
});
```

**Backend inspection route** — `server/api/routes/inspection-reports.ts`:
- Requires auth (`requireAuth` middleware), checks `user.role === "provider"`
- Validates booking belongs to the provider
- Returns 409 if report already exists for booking
- Calls `generateInspectionPDF()` on success
- Calls `notifyInspectionReport()` for customer notification

### Exact Implementation Specifications

**1. Inspection categories constant:**
```typescript
const INSPECTION_CATEGORIES = [
  "Engine",
  "Transmission",
  "Brakes",
  "Suspension",
  "Electrical",
  "Exhaust",
  "Cooling",
  "Steering",
  "Body",
  "Interior",
] as const;

const CONDITION_OPTIONS = [
  { label: "Good", value: "good", color: "bg-green-100 text-green-800" },
  { label: "Fair", value: "fair", color: "bg-blue-100 text-blue-800" },
  { label: "Poor", value: "poor", color: "bg-amber-100 text-amber-800" },
  { label: "Critical", value: "critical", color: "bg-red-100 text-red-800" },
] as const;
```

**2. API hook (`src/features/provider/api.ts`):**
```typescript
export type InspectionFinding = {
  category: string;
  component: string;
  condition: "good" | "fair" | "poor" | "critical";
  description: string;
  measurement?: string;
  photoUrl?: string;
  obdCode?: string;
};

export type CreateInspectionReportInput = {
  bookingId: string;
  findings: InspectionFinding[];
};

export const useSubmitInspectionReport = createMutation<
  void,
  CreateInspectionReportInput,
  AxiosError
>({
  mutationFn: async (variables) => {
    await client.post("/inspection-reports", variables);
  },
});
```

**3. Finding form item type:**
```typescript
type FindingFormItem = {
  id: string; // local key for React list rendering
  category: string;
  component: string;
  condition: "good" | "fair" | "poor" | "critical" | "";
  description: string;
  measurement: string;
  obdCode: string;
  photoUrl?: string;
  isExpanded: boolean; // for collapsible UI
};

const [findings, setFindings] = useState<FindingFormItem[]>([
  {
    id: createId(),
    category: "",
    component: "",
    condition: "",
    description: "",
    measurement: "",
    obdCode: "",
    isExpanded: true,
  },
]);
```

**4. OBD code input hint:**
```typescript
// OBD-II codes follow pattern: P0XXX, P1XXX, B0XXX, C0XXX, U0XXX
<TextInput
  placeholder="e.g., P0301, P0420"
  autoCapitalize="characters"
  maxLength={10}
/>
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Generate PDF on mobile | Let backend handle PDF via `generateInspectionPDF()` |
| Show inspection report button for roadside services | Only show for diagnostics/mechanics categories |
| Clear form on network error | Preserve form state for retry |
| Allow submission with zero findings | Require at least one finding |
| Put all fields on screen at once | Use collapsible sections per finding |
| Duplicate photo capture code from 18.6 | Extract shared photo capture utility |

### Dependencies and Scope

**Depends on:** Story 18.4 (job detail must have navigation to inspection report form), Story 18.6 (photo capture pattern can be reused)

**This story does NOT include:**
- Backend inspection report endpoint changes (already exists)
- PDF generation logic (server-side, already implemented)
- Customer viewing of inspection reports (already exists in web)

### NPM Dependencies

Same as Story 18.6:
- `expo-image-picker` (should already be installed from 18.6)

### Testing Guidance

1. Login as provider on mobile
2. Accept a diagnostics or mechanics job and start it
3. Tap "Submit Inspection Report" on the job
4. Add multiple findings with different categories and conditions
5. Add photo to one finding
6. Add OBD code to another finding
7. Submit — confirm success and report visible in admin
8. Check that customer received notification with PDF link
9. Try to submit again for same booking — confirm 409 handled
10. Test with poor/critical condition — confirm color-coded badges

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 18, Story 18.7]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-6.8]
- [Source: lib/validators.ts — createInspectionReportSchema]
- [Source: server/api/routes/inspection-reports.ts — Backend inspection report route]
- [Source: roadside-atl-mobile/src/features/provider/api.ts — Existing provider API hooks]
