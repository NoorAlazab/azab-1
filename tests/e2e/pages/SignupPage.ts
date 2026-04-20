import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * POM for the public /signup route.
 */
export class SignupPage extends BasePage {
  readonly url = "/signup";
  readonly readyLocator = () =>
    this.page.getByRole("heading", { name: /sign up|create account/i });

  nameInput(): Locator {
    return this.page.getByLabel(/name/i);
  }

  emailInput(): Locator {
    return this.page.getByLabel(/email/i);
  }

  passwordInput(): Locator {
    return this.page.getByLabel(/password/i, { exact: false });
  }

  submitButton(): Locator {
    return this.page.getByRole("button", { name: /sign up|create account/i });
  }

  async register(input: { name: string; email: string; password: string }): Promise<void> {
    await this.nameInput().fill(input.name);
    await this.emailInput().fill(input.email);
    await this.passwordInput().fill(input.password);
    await this.submitButton().click();
  }
}
