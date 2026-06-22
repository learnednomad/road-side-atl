import { describe, it, expect } from "vitest";
import { isPublicHttpUrl } from "@/server/api/lib/outbound-webhooks";

describe("isPublicHttpUrl (SSRF guard)", () => {
  it("allows public http(s) URLs", () => {
    expect(isPublicHttpUrl("https://partner.example.com/hook")).toBe(true);
    expect(isPublicHttpUrl("http://api.acme.io/webhooks/roadside")).toBe(true);
    expect(isPublicHttpUrl("https://8.8.8.8/hook")).toBe(true);
  });

  it("blocks non-http(s) schemes", () => {
    expect(isPublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isPublicHttpUrl("ftp://example.com")).toBe(false);
    expect(isPublicHttpUrl("not a url")).toBe(false);
  });

  it("blocks loopback + internal hostnames", () => {
    expect(isPublicHttpUrl("http://localhost/x")).toBe(false);
    expect(isPublicHttpUrl("http://foo.internal/x")).toBe(false);
    expect(isPublicHttpUrl("http://db.local/x")).toBe(false);
    expect(isPublicHttpUrl("http://[::1]/x")).toBe(false);
  });

  it("blocks private + link-local + metadata IPs", () => {
    expect(isPublicHttpUrl("http://127.0.0.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://10.0.0.5/x")).toBe(false);
    expect(isPublicHttpUrl("http://172.16.4.2/x")).toBe(false);
    expect(isPublicHttpUrl("http://192.168.1.10/x")).toBe(false);
    expect(isPublicHttpUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isPublicHttpUrl("http://100.64.0.1/x")).toBe(false);
  });
});
