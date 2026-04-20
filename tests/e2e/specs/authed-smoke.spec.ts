import { test, expect } from "../fixtures/auth.fixture";
import {
  DashboardPage,
  GeneratorPage,
  ExplorationPage,
  IntegrationsPage,
  SettingsPage,
} from "../pages";

/**
 * Authenticated smoke tests — verify that every protected route renders
 * its core landmark for a logged-in user. Uses the `authedPage` fixture
 * so each spec starts already signed in.
 *
 * Requires:
 *   - The dev server running at TEST_BASE_URL (default http://localhost:3000)
 *   - A valid local user matching `fixtures/testUser.ts` (or env overrides)
 *
 * Tagged @smoke so CI can run just these as a post-deploy gate:
 *   playwright test --grep @smoke
 */
test.describe("authed smoke @smoke", () => {
  test("dashboard", async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();
    await expect(authedPage).toHaveURL(/\/dashboard/);
  });

  test("generator", async ({ authedPage }) => {
    const generator = new GeneratorPage(authedPage);
    await generator.goto();
    await expect(authedPage).toHaveURL(/\/generator/);
  });

  test("exploration", async ({ authedPage }) => {
    const exploration = new ExplorationPage(authedPage);
    await exploration.goto();
    await expect(authedPage).toHaveURL(/\/exploration-v2/);
  });

  test("integrations", async ({ authedPage }) => {
    const integrations = new IntegrationsPage(authedPage);
    await integrations.goto();
    await expect(authedPage).toHaveURL(/\/integrations/);
  });

  test("settings", async ({ authedPage }) => {
    const settings = new SettingsPage(authedPage);
    await settings.goto();
    await expect(authedPage).toHaveURL(/\/settings/);
  });
});
