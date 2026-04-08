import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("homepage loads and shows business name", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/RoadSide/i);
    await expect(page.locator("body")).toBeVisible();
  });

  test("health endpoint returns healthy", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.database).toBe("connected");
  });

  test("services page loads", async ({ page }) => {
    await page.goto("/services");
    await expect(page.locator("body")).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test("about page loads", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("body")).toBeVisible();
  });
});
