import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * POM for the public /login route.
 *
 * Selectors use roles / accessible names first so the tests double as
 * accessibility regression checks. Fall back to data-testid only when no
 * semantic alternative is available.
 */
export class LoginPage extends BasePage {
  readonly url = "/login";
  readonly readyLocator = () =>
    this.page.getByRole("heading", { name: /sign in|log in/i });

  emailInput(): Locator {
    return this.page.getByLabel(/email/i);
  }

  passwordInput(): Locator {
    return this.page.getByLabel(/password/i);
  }

  submitButton(): Locator {
    return this.page.getByRole("button", { name: /sign in|log in/i });
  }

  errorBanner(): Locator {
    return this.page.getByRole("alert");
  }

  /**
   * Perform a full login flow. The page does NOT navigate to itself first —
   * call site is expected to have done so (via `goto()` or the auth fixture)
   * so the helper is reusable across specs that land here organically.
   */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
    await this.submitButton().click();
  }
}
