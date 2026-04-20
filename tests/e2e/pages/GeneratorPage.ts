import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * POM for the authenticated /generator page
 * (AI-powered test case generation from Jira stories).
 */
export class GeneratorPage extends BasePage {
  readonly url = "/generator";
  readonly readyLocator = () =>
    this.page.getByRole("heading", { name: /generator|generate/i });

  jqlInput(): Locator {
    return this.page.getByPlaceholder(/jql|issue key/i);
  }

  searchButton(): Locator {
    return this.page.getByRole("button", { name: /search|find/i });
  }

  storyCard(issueKey: string): Locator {
    return this.page.getByTestId(`story-card-${issueKey}`);
  }

  generateButton(): Locator {
    return this.page.getByRole("button", { name: /generate/i });
  }

  testCasesList(): Locator {
    return this.page.getByRole("region", { name: /test cases/i });
  }

  async searchStory(jql: string): Promise<void> {
    await this.jqlInput().fill(jql);
    await this.searchButton().click();
  }
}
