import { test as base, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { testUser, TestUser } from "./testUser";

/**
 * Authenticated fixture.
 *
 * Extends Playwright's built-in `test` with an `authedPage` that is
 * guaranteed to be logged in as the `testUser`. Specs that need an
 * authenticated session just destructure it instead of repeating the
 * login flow:
 *
 *   test("dashboard loads", async ({ authedPage }) => { ... });
 *
 * The fixture hits the real /api/auth/login endpoint so it exercises the
 * same code path as a real user. For fully isolated tests that should
 * never touch the backend (pure UI specs), keep using the standard `page`
 * fixture instead.
 */
type AuthFixtures = {
  testUser: TestUser;
  authedPage: import("@playwright/test").Page;
};

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    await use(testUser);
  },

  authedPage: async ({ page, testUser }, use) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(testUser.email, testUser.password);

    // Success condition: we left /login for any authenticated route.
    await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 15_000 });

    await use(page);
  },
});

export { expect };
