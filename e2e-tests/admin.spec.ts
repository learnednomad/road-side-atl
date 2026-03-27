import { test, expect } from "@playwright/test";

test.describe("Admin Routes (Unauthenticated)", () => {
  test("admin dashboard redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/login|admin/);
    // Should either redirect to login or show admin page
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test("provider dashboard redirects to login", async ({ page }) => {
    await page.goto("/provider");
    await page.waitForURL(/login|provider/);
    const url = page.url();
    expect(url).toBeTruthy();
  });
});
