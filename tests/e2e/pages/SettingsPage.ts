import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * POM for the authenticated /settings page.
 */
export class SettingsPage extends BasePage {
  readonly url = "/settings";
  readonly readyLocator = () =>
    this.page.getByRole("heading", { name: /settings/i });

  accountTab(): Locator {
    return this.page.getByRole("tab", { name: /account/i });
  }

  integrationsTab(): Locator {
    return this.page.getByRole("tab", { name: /integrations/i });
  }

  preferencesTab(): Locator {
    return this.page.getByRole("tab", { name: /preferences/i });
  }
}
