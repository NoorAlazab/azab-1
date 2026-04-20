import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { log } from "@/lib/shared/utils/logger";

/**
 * Capture a Playwright screenshot to disk and return a public web path.
 *
 * Saves under <screenshotDir>/<name>.png and converts the absolute path
 * to a `/<...>` URL relative to the Next.js `public/` directory so the
 * frontend can render it directly via an <img> tag.
 *
 * Failures are swallowed and logged — a screenshot capture problem must
 * not break the test execution loop.
 */
export async function captureScreenshot(
  page: Page,
  screenshotDir: string,
  name: string,
): Promise<string | undefined> {
  try {
    fs.mkdirSync(screenshotDir, { recursive: true });

    const filename = `${name}.png`;
    const filepath = path.join(screenshotDir, filename);

    await page.screenshot({ path: filepath, fullPage: false });

    const relativePath = filepath.replace(/\\/g, "/").split("/public/")[1];
    return relativePath ? `/${relativePath}` : undefined;
  } catch (error) {
    log.error(
      "Screenshot capture failed",
      error instanceof Error ? error : new Error(String(error)),
      { module: "TestExecutor" },
    );
    return undefined;
  }
}
