import { describe, it, expect } from "vitest";

/**
 * Tests for mechanic booking UI logic extracted from booking-form.tsx.
 * These test the pure functions that drive scheduling mode behavior.
 */

// Helper: determine if a service is scheduled-only
function isScheduledOnly(schedulingMode?: string): boolean {
  return schedulingMode === "scheduled";
}

// Helper: determine the effective booking mode given user selection + service constraint
function getEffectiveBookingMode(
  userSelection: "immediate" | "scheduled",
  serviceSchedulingMode?: string
): "immediate" | "scheduled" {
  if (serviceSchedulingMode === "scheduled") {
    return "scheduled";
  }
  return userSelection;
}

// Helper: determine if the booking mode toggle should be visible
function shouldShowModeToggle(schedulingMode?: string): boolean {
  return schedulingMode !== "scheduled";
}

// Helper: determine if the date picker is required
function isDatePickerRequired(effectiveMode: "immediate" | "scheduled"): boolean {
  return effectiveMode === "scheduled";
}

// Helper: parse vehicle info from query params (for upsell deep links)
function parseVehicleQueryParams(params: Record<string, string | null>): {
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
} {
  return {
    vehicleYear: params.vehicleYear || "",
    vehicleMake: params.vehicleMake || "",
    vehicleModel: params.vehicleModel || "",
  };
}

// Helper: build the review mode text
function getReviewModeText(
  effectiveMode: "immediate" | "scheduled",
  scheduledAt: string
): string {
  if (effectiveMode === "scheduled" && scheduledAt) {
    return `Scheduled for ${new Date(scheduledAt).toLocaleString()}`;
  }
  if (effectiveMode === "immediate") {
    return "Immediate \u2014 dispatching now";
  }
  // scheduled mode but no date yet (shouldn't happen in review, but handle gracefully)
  return "Scheduled (date pending)";
}

describe("isScheduledOnly", () => {
  it("returns true for 'scheduled' mode", () => {
    expect(isScheduledOnly("scheduled")).toBe(true);
  });

  it("returns false for 'both' mode", () => {
    expect(isScheduledOnly("both")).toBe(false);
  });

  it("returns false for 'immediate' mode", () => {
    expect(isScheduledOnly("immediate")).toBe(false);
  });

  it("returns false for undefined (legacy services)", () => {
    expect(isScheduledOnly(undefined)).toBe(false);
  });
});

describe("getEffectiveBookingMode", () => {
  it("locks to 'scheduled' when service is scheduled-only, even if user picked immediate", () => {
    expect(getEffectiveBookingMode("immediate", "scheduled")).toBe("scheduled");
  });

  it("respects user selection when service is 'both'", () => {
    expect(getEffectiveBookingMode("immediate", "both")).toBe("immediate");
    expect(getEffectiveBookingMode("scheduled", "both")).toBe("scheduled");
  });

  it("respects user selection when schedulingMode is undefined (legacy)", () => {
    expect(getEffectiveBookingMode("immediate", undefined)).toBe("immediate");
    expect(getEffectiveBookingMode("scheduled", undefined)).toBe("scheduled");
  });

  it("respects user selection when service is 'immediate' mode", () => {
    expect(getEffectiveBookingMode("immediate", "immediate")).toBe("immediate");
    expect(getEffectiveBookingMode("scheduled", "immediate")).toBe("scheduled");
  });
});

describe("shouldShowModeToggle", () => {
  it("hides toggle for scheduled-only services", () => {
    expect(shouldShowModeToggle("scheduled")).toBe(false);
  });

  it("shows toggle for 'both' mode services", () => {
    expect(shouldShowModeToggle("both")).toBe(true);
  });

  it("shows toggle for undefined (legacy services)", () => {
    expect(shouldShowModeToggle(undefined)).toBe(true);
  });

  it("shows toggle for 'immediate' mode services", () => {
    expect(shouldShowModeToggle("immediate")).toBe(true);
  });
});

describe("isDatePickerRequired", () => {
  it("requires date picker when mode is scheduled", () => {
    expect(isDatePickerRequired("scheduled")).toBe(true);
  });

  it("does not require date picker when mode is immediate", () => {
    expect(isDatePickerRequired("immediate")).toBe(false);
  });
});

describe("parseVehicleQueryParams", () => {
  it("extracts vehicle info from params", () => {
    const result = parseVehicleQueryParams({
      vehicleYear: "2020",
      vehicleMake: "Honda",
      vehicleModel: "Civic",
    });
    expect(result).toEqual({
      vehicleYear: "2020",
      vehicleMake: "Honda",
      vehicleModel: "Civic",
    });
  });

  it("returns empty strings for missing params", () => {
    const result = parseVehicleQueryParams({
      vehicleYear: null,
      vehicleMake: null,
      vehicleModel: null,
    });
    expect(result).toEqual({
      vehicleYear: "",
      vehicleMake: "",
      vehicleModel: "",
    });
  });

  it("handles partial params", () => {
    const result = parseVehicleQueryParams({
      vehicleYear: "2021",
      vehicleMake: null,
      vehicleModel: "Camry",
    });
    expect(result).toEqual({
      vehicleYear: "2021",
      vehicleMake: "",
      vehicleModel: "Camry",
    });
  });
});

describe("getReviewModeText", () => {
  it("shows scheduled date for scheduled bookings", () => {
    const date = new Date("2026-04-15T10:00:00").toISOString();
    const text = getReviewModeText("scheduled", date);
    expect(text).toContain("Scheduled for");
    expect(text).not.toBe("Immediate \u2014 dispatching now");
  });

  it("shows immediate text for immediate bookings", () => {
    const text = getReviewModeText("immediate", "");
    expect(text).toBe("Immediate \u2014 dispatching now");
  });

  it("handles scheduled mode without date gracefully", () => {
    const text = getReviewModeText("scheduled", "");
    expect(text).toBe("Scheduled (date pending)");
  });
});

describe("Service pre-selection with query params", () => {
  const mockServices = [
    { id: "1", slug: "towing", schedulingMode: "both" },
    { id: "2", slug: "oil-change", schedulingMode: "scheduled" },
    { id: "3", slug: "jump-start", schedulingMode: "both" },
  ];

  it("finds service by slug from query param", () => {
    const preselectedSlug = "oil-change";
    const match = mockServices.find((s) => s.slug === preselectedSlug);
    expect(match).toBeDefined();
    expect(match!.id).toBe("2");
    expect(match!.schedulingMode).toBe("scheduled");
  });

  it("returns undefined for non-existent service slug", () => {
    const preselectedSlug = "non-existent";
    const match = mockServices.find((s) => s.slug === preselectedSlug);
    expect(match).toBeUndefined();
  });
});

describe("Booking mode locking integration", () => {
  it("full flow: scheduled-only service locks mode and requires date", () => {
    const service = { schedulingMode: "scheduled" };

    // Service is scheduled-only
    expect(isScheduledOnly(service.schedulingMode)).toBe(true);

    // Toggle should be hidden
    expect(shouldShowModeToggle(service.schedulingMode)).toBe(false);

    // Mode is locked to scheduled regardless of user preference
    const effectiveMode = getEffectiveBookingMode("immediate", service.schedulingMode);
    expect(effectiveMode).toBe("scheduled");

    // Date picker is required
    expect(isDatePickerRequired(effectiveMode)).toBe(true);
  });

  it("full flow: 'both' mode service allows user choice", () => {
    const service = { schedulingMode: "both" };

    // Not scheduled-only
    expect(isScheduledOnly(service.schedulingMode)).toBe(false);

    // Toggle should be visible
    expect(shouldShowModeToggle(service.schedulingMode)).toBe(true);

    // User can pick immediate
    const immediateMode = getEffectiveBookingMode("immediate", service.schedulingMode);
    expect(immediateMode).toBe("immediate");
    expect(isDatePickerRequired(immediateMode)).toBe(false);

    // User can pick scheduled
    const scheduledMode = getEffectiveBookingMode("scheduled", service.schedulingMode);
    expect(scheduledMode).toBe("scheduled");
    expect(isDatePickerRequired(scheduledMode)).toBe(true);
  });
});
