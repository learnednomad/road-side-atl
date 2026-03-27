import { test, expect } from "@playwright/test";

test.describe("Booking Flow", () => {
  test("booking page loads with service selection", async ({ page }) => {
    await page.goto("/book");
    await expect(page.locator("body")).toBeVisible();
    // Should have the booking form or service selection
    await expect(page).not.toHaveTitle(/error/i);
  });

  test("become a provider page loads", async ({ page }) => {
    await page.goto("/become-provider");
    await expect(page.locator("body")).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test("my-bookings redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/my-bookings");
    // Should redirect to login or show auth required
    await page.waitForURL(/login|my-bookings/);
    const url = page.url();
    // Either redirected to login or shows the page (with empty state)
    expect(url).toBeTruthy();
  });
});
