import { Page, Locator, expect } from "@playwright/test";

/**
 * BasePage is the root of the Page Object Model tree.
 *
 * Every concrete page (LoginPage, DashboardPage, ...) extends this class and
 * inherits a small, opinionated set of navigation + wait helpers so specs
 * never need to reach for `page.*` directly. This keeps tests declarative
 * ("I am on the dashboard") rather than imperative ("wait for selector X,
 * then Y, ...").
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Path segment this page owns, e.g. "/login" or "/dashboard". */
  abstract readonly url: string;

  /**
   * Selector that uniquely identifies the page has finished loading.
   * Concrete pages override to point at a stable, user-visible landmark
   * (heading, hero element) to avoid flaky "page loaded" detection.
   */
  abstract readonly readyLocator: () => Locator;

  /** Navigate to this page by its canonical `url`. */
  async goto(): Promise<void> {
    await this.page.goto(this.url);
    await this.waitUntilReady();
  }

  /** Assert the page is fully rendered by waiting for its `readyLocator`. */
  async waitUntilReady(): Promise<void> {
    await expect(this.readyLocator()).toBeVisible({ timeout: 10_000 });
  }

  /** Convenience: current URL path (without origin / query). */
  path(): string {
    return new URL(this.page.url()).pathname;
  }

  /** Convenience exposed to specs that occasionally need raw page access. */
  raw(): Page {
    return this.page;
  }
}
