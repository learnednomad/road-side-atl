import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { sendOpsAlert, __resetOpsAlertThrottle } from "@/server/api/lib/ops-alerts";

describe("sendOpsAlert", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    __resetOpsAlertThrottle();
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue({ ok: true }));
    delete process.env.SLACK_OPS_WEBHOOK_URL;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is a no-op when SLACK_OPS_WEBHOOK_URL is unset", () => {
    sendOpsAlert({ title: "test" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to the webhook when configured", async () => {
    process.env.SLACK_OPS_WEBHOOK_URL = "https://hooks.slack.test/xyz";
    sendOpsAlert({ title: "payout.failed", severity: "critical", fields: { resource: "payout abc", amount: 7500 } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.slack.test/xyz");
    const body = JSON.parse(opts.body);
    expect(body.text).toContain("payout.failed");
    expect(body.text).toContain("amount:");
  });

  it("throttles identical dedupe keys within the window", () => {
    process.env.SLACK_OPS_WEBHOOK_URL = "https://hooks.slack.test/xyz";
    sendOpsAlert({ title: "x", dedupeKey: "k" });
    sendOpsAlert({ title: "x", dedupeKey: "k" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("never throws when fetch rejects (fail-open)", () => {
    process.env.SLACK_OPS_WEBHOOK_URL = "https://hooks.slack.test/xyz";
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(() => sendOpsAlert({ title: "y" })).not.toThrow();
  });
});
