import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("login page loads with form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', "fake@example.com");
    await page.fill('input[type="password"], input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    // Should stay on login page or show error
    await expect(page).toHaveURL(/login|error/);
  });

  test("register page loads with form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });
});
