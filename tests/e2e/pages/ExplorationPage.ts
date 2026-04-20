import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * POM for the authenticated /exploration-v2 page
 * (autonomous crawling + bug detection).
 */
export class ExplorationPage extends BasePage {
  readonly url = "/exploration-v2";
  readonly readyLocator = () =>
    this.page.getByRole("heading", { name: /exploration|explore/i });

  storyInput(): Locator {
    return this.page.getByLabel(/story|issue key/i);
  }

  envUrlInput(): Locator {
    return this.page.getByLabel(/environment url|base url/i);
  }

  startButton(): Locator {
    return this.page.getByRole("button", { name: /start|run/i });
  }

  resultsPanel(): Locator {
    return this.page.getByRole("region", { name: /results|findings/i });
  }

  async startRun(input: { story: string; envUrl: string }): Promise<void> {
    await this.storyInput().fill(input.story);
    await this.envUrlInput().fill(input.envUrl);
    await this.startButton().click();
  }
}
