import { describe, it, expect } from "vitest";
import { validateFileContent } from "@/lib/s3";

describe("validateFileContent", () => {
  it("should validate PNG magic bytes", () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateFileContent(pngBuffer, "image/png")).toBe(true);
  });

  it("should reject invalid PNG", () => {
    const notPng = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    expect(validateFileContent(notPng, "image/png")).toBe(false);
  });

  it("should validate JPEG magic bytes", () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateFileContent(jpegBuffer, "image/jpeg")).toBe(true);
  });

  it("should reject invalid JPEG", () => {
    const notJpeg = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    expect(validateFileContent(notJpeg, "image/jpeg")).toBe(false);
  });

  it("should validate WebP magic bytes (RIFF header)", () => {
    const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
    expect(validateFileContent(webpBuffer, "image/webp")).toBe(true);
  });

  it("should validate SVG content", () => {
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(validateFileContent(svgBuffer, "image/svg+xml")).toBe(true);
  });

  it("should validate SVG with XML declaration", () => {
    const svgBuffer = Buffer.from('<?xml version="1.0"?><svg></svg>');
    expect(validateFileContent(svgBuffer, "image/svg+xml")).toBe(true);
  });

  it("should reject invalid SVG", () => {
    const notSvg = Buffer.from("This is just plain text, not SVG");
    expect(validateFileContent(notSvg, "image/svg+xml")).toBe(false);
  });

  it("should reject unknown content type", () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    expect(validateFileContent(buffer, "application/pdf")).toBe(false);
  });

  it("should reject PNG declared as JPEG (type mismatch)", () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateFileContent(pngBuffer, "image/jpeg")).toBe(false);
  });
});
