import { describe, it, expect, beforeAll, vi } from "vitest";
import { randomBytes } from "crypto";

// Set up a valid 32-byte encryption key before importing the module
const TEST_KEY = randomBytes(32).toString("hex");

beforeAll(() => {
  vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
});

describe("encryption", () => {
  it("encrypts and decrypts a string roundtrip", async () => {
    const { encrypt, decrypt } = await import("@/server/api/lib/encryption");
    const plaintext = "Hello, RoadSide ATL!";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for same plaintext (random IV)", async () => {
    const { encrypt } = await import("@/server/api/lib/encryption");
    const plaintext = "same input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("encrypted format is iv:tag:ciphertext (hex)", async () => {
    const { encrypt } = await import("@/server/api/lib/encryption");
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // Auth tag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Ciphertext length varies
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("handles empty string", async () => {
    const { encrypt, decrypt } = await import("@/server/api/lib/encryption");
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("handles unicode characters", async () => {
    const { encrypt, decrypt } = await import("@/server/api/lib/encryption");
    const plaintext = "Roadside 🚗 Atlanta — $50.00 résumé";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("handles long strings", async () => {
    const { encrypt, decrypt } = await import("@/server/api/lib/encryption");
    const plaintext = "A".repeat(10000);
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("throws on tampered ciphertext", async () => {
    const { encrypt, decrypt } = await import("@/server/api/lib/encryption");
    const encrypted = encrypt("sensitive data");
    const parts = encrypted.split(":");
    // Tamper with ciphertext
    const tampered = parts[0] + ":" + parts[1] + ":ff" + parts[2].slice(2);
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on invalid format", async () => {
    const { decrypt } = await import("@/server/api/lib/encryption");
    expect(() => decrypt("not-valid-format")).toThrow("Invalid encrypted format");
  });
});
