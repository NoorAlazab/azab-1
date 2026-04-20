import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * POM for the authenticated /integrations page (Jira, Atlassian OAuth).
 */
export class IntegrationsPage extends BasePage {
  readonly url = "/integrations";
  readonly readyLocator = () =>
    this.page.getByRole("heading", { name: /integrations/i });

  connectJiraButton(): Locator {
    return this.page.getByRole("button", { name: /connect.*jira|connect atlassian/i });
  }

  disconnectJiraButton(): Locator {
    return this.page.getByRole("button", { name: /disconnect.*jira/i });
  }

  jiraStatusBadge(): Locator {
    return this.page.getByTestId("jira-connection-status");
  }
}
