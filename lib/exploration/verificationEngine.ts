/**
 * Verification Engine
 * Handles all verification/assertion steps in test cases
 */

import type { Page } from 'playwright';
import { log } from '@/lib/utils/logger';

export interface VerificationResult {
  passed: boolean;
  expected: string;
  observed: string;
  evidence?: string; // Screenshot path or URL
  error?: string;
}

/**
 * Verify that specific text exists on the page
 */
export async function verifyTextExists(
  page: Page,
  text: string,
  shouldExist: boolean = true
): Promise<VerificationResult> {
  try {
    // Get page content
    const bodyText = await page.textContent('body').catch(() => '');
    const pageText = bodyText || '';

    // Check if text exists
    const exists = pageText.includes(text);
    const passed = exists === shouldExist;

    // Extract context around the text (if found)
    let observed = exists
      ? `Text "${text}" found on page`
      : `Text "${text}" not found on page`;

    if (exists) {
      // Try to get more context
      const context = await page
        .locator(`text=${text}`)
        .first()
        .textContent()
        .catch(() => null);
      if (context) {
        observed = `Found: "${context.substring(0, 100)}${context.length > 100 ? '...' : ''}"`;
      }
    } else {
      // Show a sample of what was actually on the page
      const sample = pageText.substring(0, 200);
      observed = `Text not found. Page contains: "${sample}${pageText.length > 200 ? '...' : ''}"`;
    }

    return {
      passed,
      expected: shouldExist ? `Page should contain "${text}"` : `Page should not contain "${text}"`,
      observed,
    };
  } catch (error) {
    log.error('Text verification error', error instanceof Error ? error : new Error(String(error)), {
      module: 'VerificationEngine',
    });
    return {
      passed: false,
      expected: shouldExist ? `Page should contain "${text}"` : `Page should not contain "${text}"`,
      observed: 'Error checking page text',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify that a specific element exists and is visible
 */
export async function verifyElementExists(
  page: Page,
  selector: string,
  shouldExist: boolean = true
): Promise<VerificationResult> {
  try {
    const element = page.locator(selector).first();
    const count = await element.count();
    const exists = count > 0;

    let isVisible = false;
    if (exists) {
      isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
    }

    const passed = (exists && isVisible) === shouldExist;

    let observed = '';
    if (!exists) {
      observed = `Element with selector "${selector}" not found in DOM`;
    } else if (!isVisible) {
      observed = `Element found but not visible`;
    } else {
      // Try to get element details
      const tagName = await element.evaluate(el => el.tagName.toLowerCase()).catch(() => 'unknown');
      const textContent = await element.textContent().catch(() => '');
      observed = `${tagName} element found${textContent ? ` with text: "${textContent.substring(0, 50)}"` : ''}`;
    }

    return {
      passed,
      expected: shouldExist
        ? `Element "${selector}" should be visible`
        : `Element "${selector}" should not exist`,
      observed,
    };
  } catch (error) {
    log.error('Element verification error', error instanceof Error ? error : new Error(String(error)), {
      module: 'VerificationEngine',
    });
    return {
      passed: false,
      expected: shouldExist
        ? `Element "${selector}" should be visible`
        : `Element "${selector}" should not exist`,
      observed: 'Error checking element',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify current URL matches expected
 */
export async function verifyUrl(
  page: Page,
  expectedUrl: string,
  exact: boolean = false
): Promise<VerificationResult> {
  try {
    const currentUrl = page.url();
    let passed = false;

    if (exact) {
      passed = currentUrl === expectedUrl;
    } else {
      // Check if URL contains the expected part or matches pattern
      passed = currentUrl.includes(expectedUrl) || new RegExp(expectedUrl).test(currentUrl);
    }

    return {
      passed,
      expected: exact
        ? `URL should be exactly "${expectedUrl}"`
        : `URL should contain "${expectedUrl}"`,
      observed: `Current URL: ${currentUrl}`,
    };
  } catch (error) {
    log.error('URL verification error', error instanceof Error ? error : new Error(String(error)), {
      module: 'VerificationEngine',
    });
    return {
      passed: false,
      expected: exact
        ? `URL should be exactly "${expectedUrl}"`
        : `URL should contain "${expectedUrl}"`,
      observed: 'Error getting current URL',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify element is enabled (for buttons, inputs)
 */
export async function verifyElementEnabled(
  page: Page,
  selector: string,
  shouldBeEnabled: boolean = true
): Promise<VerificationResult> {
  try {
    const element = page.locator(selector).first();
    const count = await element.count();

    if (count === 0) {
      return {
        passed: false,
        expected: `Element "${selector}" should ${shouldBeEnabled ? 'be' : 'not be'} enabled`,
        observed: 'Element not found',
      };
    }

    const isEnabled = await element.isEnabled({ timeout: 2000 }).catch(() => false);
    const passed = isEnabled === shouldBeEnabled;

    return {
      passed,
      expected: `Element "${selector}" should ${shouldBeEnabled ? 'be' : 'not be'} enabled`,
      observed: `Element is ${isEnabled ? 'enabled' : 'disabled'}`,
    };
  } catch (error) {
    log.error('Element enabled verification error', error instanceof Error ? error : new Error(String(error)), {
      module: 'VerificationEngine',
    });
    return {
      passed: false,
      expected: `Element "${selector}" should ${shouldBeEnabled ? 'be' : 'not be'} enabled`,
      observed: 'Error checking element state',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify input field has specific value
 */
export async function verifyInputValue(
  page: Page,
  selector: string,
  expectedValue: string
): Promise<VerificationResult> {
  try {
    const element = page.locator(selector).first();
    const count = await element.count();

    if (count === 0) {
      return {
        passed: false,
        expected: `Input "${selector}" should have value "${expectedValue}"`,
        observed: 'Element not found',
      };
    }

    const actualValue = await element.inputValue().catch(() => '');
    const passed = actualValue === expectedValue;

    return {
      passed,
      expected: `Input "${selector}" should have value "${expectedValue}"`,
      observed: `Input has value "${actualValue}"`,
    };
  } catch (error) {
    log.error('Input value verification error', error instanceof Error ? error : new Error(String(error)), {
      module: 'VerificationEngine',
    });
    return {
      passed: false,
      expected: `Input "${selector}" should have value "${expectedValue}"`,
      observed: 'Error checking input value',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify page title matches expected
 */
export async function verifyPageTitle(
  page: Page,
  expectedTitle: string,
  exact: boolean = false
): Promise<VerificationResult> {
  try {
    const actualTitle = await page.title();
    let passed = false;

    if (exact) {
      passed = actualTitle === expectedTitle;
    } else {
      passed = actualTitle.includes(expectedTitle);
    }

    return {
      passed,
      expected: exact
        ? `Page title should be "${expectedTitle}"`
        : `Page title should contain "${expectedTitle}"`,
      observed: `Page title is "${actualTitle}"`,
    };
  } catch (error) {
    log.error('Page title verification error', error instanceof Error ? error : new Error(String(error)), {
      module: 'VerificationEngine',
    });
    return {
      passed: false,
      expected: exact
        ? `Page title should be "${expectedTitle}"`
        : `Page title should contain "${expectedTitle}"`,
      observed: 'Error getting page title',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify no console errors (useful for smoke tests)
 */
export async function verifyNoConsoleErrors(
  page: Page,
  consoleErrors: string[]
): Promise<VerificationResult> {
  const errorCount = consoleErrors.length;
  const passed = errorCount === 0;

  return {
    passed,
    expected: 'No console errors',
    observed: errorCount === 0
      ? 'No console errors detected'
      : `${errorCount} console error(s): ${consoleErrors.slice(0, 3).join('; ')}${errorCount > 3 ? '...' : ''}`,
  };
}

/**
 * Verify no network errors (HTTP 4xx/5xx)
 */
export async function verifyNoNetworkErrors(
  page: Page,
  networkErrors: Array<{ url: string; status: number }>
): Promise<VerificationResult> {
  const errorCount = networkErrors.length;
  const passed = errorCount === 0;

  return {
    passed,
    expected: 'No network errors (4xx/5xx)',
    observed: errorCount === 0
      ? 'All network requests successful'
      : `${errorCount} failed request(s): ${networkErrors.slice(0, 2).map(e => `${e.status} ${e.url}`).join('; ')}${errorCount > 2 ? '...' : ''}`,
  };
}
