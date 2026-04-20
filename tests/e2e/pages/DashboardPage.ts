import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * POM for the authenticated /dashboard page.
 */
export class DashboardPage extends BasePage {
  readonly url = "/dashboard";
  readonly readyLocator = () =>
    this.page.getByRole("heading", { name: /dashboard/i });

  checklistSection(): Locator {
    return this.page.getByRole("region", { name: /checklist/i });
  }

  activityFeed(): Locator {
    return this.page.getByRole("region", { name: /activity/i });
  }

  jiraStatusBadge(): Locator {
    return this.page.getByTestId("jira-connection-status");
  }
}
