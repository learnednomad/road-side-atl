import { describe, it, expect } from "vitest";
import {
  providerApplicationSchema,
  inviteAcceptSchema,
  onboardingInviteSchema,
} from "@/lib/validators";

describe("providerApplicationSchema", () => {
  const validData = {
    name: "John Doe",
    email: "john@example.com",
    password: "securePass123",
    phone: "4045550123",
    serviceArea: ["Atlanta ITP"],
    specialties: ["Tire Change", "Jump Start"],
    fcraConsent: true,
  };

  it("accepts valid application data", () => {
    const result = providerApplicationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = providerApplicationSchema.safeParse({ ...validData, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = providerApplicationSchema.safeParse({ ...validData, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = providerApplicationSchema.safeParse({ ...validData, password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects short phone", () => {
    const result = providerApplicationSchema.safeParse({ ...validData, phone: "123" });
    expect(result.success).toBe(false);
  });

  it("rejects empty serviceArea", () => {
    const result = providerApplicationSchema.safeParse({ ...validData, serviceArea: [] });
    expect(result.success).toBe(false);
  });

  it("rejects fcraConsent=false", () => {
    const result = providerApplicationSchema.safeParse({ ...validData, fcraConsent: false });
    expect(result.success).toBe(false);
  });

  it("accepts missing specialties (optional)", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { specialties: _specialties, ...rest } = validData;
    const result = providerApplicationSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejects non-boolean fcraConsent", () => {
    const result = providerApplicationSchema.safeParse({ ...validData, fcraConsent: "yes" });
    expect(result.success).toBe(false);
  });
});

describe("inviteAcceptSchema", () => {
  const validData = {
    inviteToken: "abc123-token",
    password: "securePass123",
    phone: "4045550123",
    serviceArea: ["Atlanta OTP"],
    specialties: [],
    fcraConsent: true,
  };

  it("accepts valid invite accept data", () => {
    const result = inviteAcceptSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects missing token", () => {
    const result = inviteAcceptSchema.safeParse({ ...validData, inviteToken: "" });
    expect(result.success).toBe(false);
  });

  it("rejects fcraConsent=false", () => {
    const result = inviteAcceptSchema.safeParse({ ...validData, fcraConsent: false });
    expect(result.success).toBe(false);
  });

  it("rejects empty serviceArea", () => {
    const result = inviteAcceptSchema.safeParse({ ...validData, serviceArea: [] });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = inviteAcceptSchema.safeParse({ ...validData, password: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("onboardingInviteSchema", () => {
  it("accepts valid invite data", () => {
    const result = onboardingInviteSchema.safeParse({
      email: "provider@example.com",
      name: "Jane Provider",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = onboardingInviteSchema.safeParse({
      email: "not-valid",
      name: "Jane",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short name", () => {
    const result = onboardingInviteSchema.safeParse({
      email: "jane@example.com",
      name: "J",
    });
    expect(result.success).toBe(false);
  });
});
