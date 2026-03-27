import { test, expect } from "@playwright/test";

test.describe("API Endpoints", () => {
  test("health endpoint returns healthy", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("healthy");
  });

  test("API returns 401 for unauthenticated requests", async ({ request }) => {
    const endpoints = [
      "/api/hono/bookings",
      "/api/hono/provider/jobs",
      "/api/hono/admin/providers",
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect(response.status()).toBe(401);
    }
  });

  test("login endpoint rejects invalid credentials", async ({ request }) => {
    const response = await request.post("/api/hono/auth/login", {
      data: { email: "nonexistent@test.com", password: "wrongpass" },
    });
    expect([400, 401]).toContain(response.status());
  });
});
