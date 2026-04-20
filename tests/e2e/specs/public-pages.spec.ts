import { test, expect } from "@playwright/test";
import { LoginPage, SignupPage } from "../pages";

/**
 * Public-page smoke tests. These don't require any auth and verify that the
 * unauthenticated entry points render correctly.
 */
test.describe("public pages", () => {
  test("login page renders its form", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(login.emailInput()).toBeVisible();
    await expect(login.passwordInput()).toBeVisible();
    await expect(login.submitButton()).toBeEnabled();
  });

  test("signup page renders its form", async ({ page }) => {
    const signup = new SignupPage(page);
    await signup.goto();
    await expect(signup.emailInput()).toBeVisible();
    await expect(signup.passwordInput()).toBeVisible();
    await expect(signup.submitButton()).toBeEnabled();
  });

  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
