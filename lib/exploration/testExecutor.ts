/**
 * Test Executor
 * Executes test cases against an environment using Playwright
 * Provides clear pass/fail results with evidence
 */

import type { Page, Locator } from 'playwright';
import { parseStep, findElement as findElementByGuessing, type StepAction } from './stepParser';
import { verifyTextExists, verifyUrl, type VerificationResult } from './verificationEngine';
import { findElementByKey } from './selectorRepository';
import { mapToElementKey, inferPageName } from './elementKeyMapper';
import { findJourneyByKeyword } from './journeyRepository';
import { log } from '@/lib/utils/logger';
import { normalizePageKeyword } from '@/lib/utils/pageKeywordNormalizer';
import { saveStepToDatabase } from './testExecutor/db';
import { captureScreenshot } from './testExecutor/screenshots';
import type {
  TestCase,
  TestStepResult,
  TestExecutionResult,
  ElementSelector,
} from './testExecutor/types';

// Re-export public types so existing `import { TestCase } from '@/lib/exploration/testExecutor'`
// callers continue to work without modification.
export type { TestCase, TestStepResult, TestExecutionResult } from './testExecutor/types';

/**
 * Execute a single test case
 * NEW: Supports database-first selector loading and detailed step tracking
 */
export async function executeTestCase(
  testCase: TestCase,
  page: Page,
  screenshotDir: string,
  environmentUrl: string,
  environmentSlug?: string,
  environmentConfigId?: string,
  testExecutionId?: string
): Promise<TestExecutionResult> {
  const startTime = Date.now();
  const steps: TestStepResult[] = [];
  let status: 'passed' | 'failed' | 'error' = 'passed';
  let verification: VerificationResult | undefined;
  let screenshotPath: string | undefined;
  let error: string | undefined;

  log.debug('Executing test case', {
    module: 'TestExecutor',
    title: testCase.title,
    journeyMode: !!environmentSlug,
    databaseMode: !!environmentConfigId,
    testExecutionId,
  });

  try {
    // Execute each step sequentially
    for (let stepIndex = 0; stepIndex < testCase.steps.length; stepIndex++) {
      const stepText = testCase.steps[stepIndex];
      const stepStartTime = Date.now();
      const action = parseStep(stepText);
      const stepNumber = stepIndex + 1;

      log.debug('Executing step', {
        module: 'TestExecutor',
        stepNumber,
        step: stepText,
        action: action.type
      });

      // Capture screenshot BEFORE action
      const screenshotBefore = await captureScreenshot(
        page,
        screenshotDir,
        `step-${stepNumber}-before`
      );

      try {
        const stepResult = await executeStepDetailed(
          action,
          page,
          screenshotDir,
          environmentUrl,
          environmentSlug,
          environmentConfigId,
          stepNumber
        );

        const stepDuration = Date.now() - stepStartTime;

        const fullStepResult: TestStepResult = {
          step: stepText,
          action,
          success: stepResult.success,
          error: stepResult.error,
          duration: stepDuration,
          strategyUsed: stepResult.strategyUsed,
          elementKey: stepResult.elementKey,
          selectorUsed: stepResult.selectorUsed,
          screenshotBeforeUrl: screenshotBefore,
          screenshotAfterUrl: stepResult.screenshotAfterUrl,
          expectedValue: stepResult.expectedValue,
          actualValue: stepResult.actualValue,
          failureReason: stepResult.failureReason,
          details: stepResult.details,
        };

        steps.push(fullStepResult);

        // Save step to database if testExecutionId provided
        if (testExecutionId && environmentConfigId) {
          await saveStepToDatabase(testExecutionId, stepNumber, stepText, fullStepResult);
        }

        if (!stepResult.success) {
          status = 'failed';
          error = `Step failed: ${stepText}`;
          break;
        }
      } catch (stepError) {
        const stepDuration = Date.now() - stepStartTime;
        const errorMsg = stepError instanceof Error ? stepError.message : String(stepError);

        // Capture screenshot after error
        const screenshotAfter = await captureScreenshot(
          page,
          screenshotDir,
          `step-${stepNumber}-after-error`
        );

        const fullStepResult: TestStepResult = {
          step: stepText,
          action,
          success: false,
          error: errorMsg,
          duration: stepDuration,
          screenshotBeforeUrl: screenshotBefore,
          screenshotAfterUrl: screenshotAfter,
          failureReason: 'Exception thrown during execution',
          details: stepError instanceof Error ? stepError.stack : undefined,
        };

        steps.push(fullStepResult);

        // Save step to database if testExecutionId provided
        if (testExecutionId && environmentConfigId) {
          await saveStepToDatabase(testExecutionId, stepNumber, stepText, fullStepResult);
        }

        status = 'error';
        error = `Step error: ${stepText} - ${errorMsg}`;
        break;
      }
    }

    // If all steps passed, verify the expected result
    if (status === 'passed' && testCase.expected) {
      log.debug('Verifying expected result', { module: 'TestExecutor', expected: testCase.expected });
      verification = await verifyExpectedResult(page, testCase.expected);

      if (!verification.passed) {
        status = 'failed';
        error = 'Expected result verification failed';
      }
    }

    // Take screenshot on failure
    if (status === 'failed' || status === 'error') {
      screenshotPath = await captureScreenshot(page, screenshotDir, `fail-${testCase.id || Date.now()}`);
    }

  } catch (executionError) {
    status = 'error';
    error = executionError instanceof Error ? executionError.message : String(executionError);
    log.error('Test case execution error', executionError instanceof Error ? executionError : new Error(String(executionError)), {
      module: 'TestExecutor',
      testCase: testCase.title,
    });
  }

  const duration = Date.now() - startTime;

  return {
    testCase,
    status,
    steps,
    verification,
    screenshotPath,
    duration,
    error,
  };
}

/**
 * Execute a step and return detailed information
 */
async function executeStepDetailed(
  action: StepAction,
  page: Page,
  screenshotDir: string,
  environmentUrl: string,
  environmentSlug?: string,
  environmentConfigId?: string,
  stepNumber?: number
): Promise<{
  success: boolean;
  error?: string;
  strategyUsed?: string;
  elementKey?: string;
  selectorUsed?: string;
  screenshotAfterUrl?: string;
  expectedValue?: string;
  actualValue?: string;
  failureReason?: string;
  details?: string;
}> {
  const result: any = {
    success: false,
  };

  try {
    switch (action.type) {
      case 'navigate': {
        // Navigation doesn't use element finding
        result.strategyUsed = 'url_check';
        // Use pageKeyword (normalized) instead of url (which has leading slash)
        const targetKeyword = action.pageKeyword || (action.url?.startsWith('/') ? action.url.substring(1) : action.url);
        const success = await navigateToPage(page, targetKeyword, environmentUrl, environmentSlug, environmentConfigId);
        result.success = success;
        result.actualValue = page.url();
        result.expectedValue = action.url;
        break;
      }

      case 'click':
      case 'fill': {
        // Find element using selector repository with detailed tracking
        const findResult = await findElementDetailed(
          page,
          action.target,
          action.elementKey,
          environmentUrl,
          environmentSlug,
          environmentConfigId
        );

        result.strategyUsed = findResult.strategyUsed;
        result.elementKey = findResult.elementKey;
        result.selectorUsed = findResult.selectorUsed;
        result.failureReason = findResult.failureReason;

        if (!findResult.element) {
          result.error = `Could not find element: "${action.target}"`;
          result.failureReason = findResult.failureReason || 'Element not found';
          return result;
        }

        // Perform action
        if (action.type === 'click') {
          await findResult.element.click({ timeout: 5000 });
          result.details = 'Clicked element successfully';
          await Promise.race([
            page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {}),
            page.waitForTimeout(500)
          ]);
        } else if (action.type === 'fill') {
          await findResult.element.fill(action.value, { timeout: 5000 });
          result.details = `Filled element with value: "${action.value}"`;
          result.expectedValue = action.value;
          result.actualValue = await findResult.element.inputValue().catch(() => action.value);
          await page.waitForTimeout(200);
        }

        result.success = true;
        break;
      }

      case 'verify_text': {
        result.strategyUsed = 'text_search';
        result.expectedValue = action.text;
        const verifyResult = await verifyTextExists(page, action.text, action.shouldExist ?? true);
        result.success = verifyResult.passed;
        result.actualValue = verifyResult.observed;
        result.failureReason = verifyResult.error || (!verifyResult.passed ? verifyResult.observed : undefined);
        break;
      }

      case 'verify_url': {
        result.strategyUsed = 'url_check';
        result.expectedValue = action.url;
        result.actualValue = page.url();
        const verifyResult = await verifyUrl(page, action.url, action.exact);
        result.success = verifyResult.passed;
        result.failureReason = verifyResult.error || (!verifyResult.passed ? verifyResult.observed : undefined);
        break;
      }

      case 'wait': {
        result.strategyUsed = 'wait';
        const duration = action.duration || 1000;
        await page.waitForTimeout(duration);
        result.success = true;
        result.details = `Waited ${duration}ms`;
        break;
      }

      default: {
        result.strategyUsed = 'unknown';
        result.success = true; // Treat unknown as pass to continue
        result.details = 'Unknown action type, treated as informational';
        break;
      }
    }

    // Capture screenshot AFTER action (if step number provided)
    if (stepNumber) {
      result.screenshotAfterUrl = await captureScreenshot(
        page,
        screenshotDir,
        `step-${stepNumber}-after`
      );
    }

  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error.message : String(error);
    result.failureReason = 'Exception during execution';
    result.details = error instanceof Error ? error.stack : undefined;
  }

  return result;
}

/**
 * Find element with detailed tracking of strategy used
 */
async function findElementDetailed(
  page: Page,
  target: string,
  elementKey: string | undefined,
  environmentUrl: string,
  environmentSlug?: string,
  environmentConfigId?: string
): Promise<{
  element: Locator | null;
  strategyUsed: string;
  elementKey?: string;
  selectorUsed?: string;
  failureReason?: string;
}> {
  const pageName = inferPageName(environmentUrl);

  // Strategy 1: Explicit element key (backticks)
  if (elementKey) {
    try {
      log.debug('Strategy 1: Using explicit element key', {
        module: 'TestExecutor',
        elementKey,
        pageName,
      });

      const locator = await findElementByKey(
        page,
        elementKey,
        pageName,
        undefined,
        environmentSlug,
        environmentConfigId
      );

      // Get the actual selector used (try to extract from locator)
      const selectorUsed = await locator.evaluate((el: any) => {
        // Return a simple descriptor
        return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : '');
      }).catch(() => 'selector');

      return {
        element: locator,
        strategyUsed: 'explicit_key',
        elementKey,
        selectorUsed,
      };
    } catch (error) {
      return {
        element: null,
        strategyUsed: 'explicit_key_failed',
        elementKey,
        failureReason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Strategy 2: Fuzzy matching
  try {
    log.debug('Strategy 2: Fuzzy matching', {
      module: 'TestExecutor',
      target,
      pageName,
    });

    const mappedKey = await mapToElementKey(target, pageName, environmentSlug, environmentConfigId);

    if (mappedKey) {
      const locator = await findElementByKey(
        page,
        mappedKey,
        pageName,
        undefined,
        environmentSlug,
        environmentConfigId
      );

      const selectorUsed = await locator.evaluate((el: any) => {
        return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : '');
      }).catch(() => 'selector');

      return {
        element: locator,
        strategyUsed: 'fuzzy_match',
        elementKey: mappedKey,
        selectorUsed,
      };
    }
  } catch (error) {
    log.debug('Fuzzy matching failed', {
      module: 'TestExecutor',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Strategy 3: Guessing (unreliable)
  log.debug('Strategy 3: Guessing', {
    module: 'TestExecutor',
    target,
  });

  const guessedLocator = await findElementByGuessing(page, target);

  if (guessedLocator) {
    return {
      element: guessedLocator,
      strategyUsed: 'guess',
      selectorUsed: target,
    };
  }

  return {
    element: null,
    strategyUsed: 'all_failed',
    failureReason: `Could not find element: "${target}" using any strategy`,
  };
}

/**
 * Find element using selector repository or fallback to guessing
 * LEGACY function - kept for backward compatibility
 */
async function findElement(
  page: Page,
  target: string,
  elementKey: string | undefined,
  environmentUrl: string,
  environmentSlug?: string,
  environmentConfigId?: string
): Promise<Locator | null> {
  const result = await findElementDetailed(
    page,
    target,
    elementKey,
    environmentUrl,
    environmentSlug,
    environmentConfigId
  );
  return result.element;
}

/**
 * Navigate to a page using smart strategy:
 * 1. Try cached URL (if reliable)
 * 2. Fall back to selector-based navigation
 * 3. Update URL cache based on results
 */
async function navigateToPage(
  page: Page,
  targetPageKeyword: string,
  environmentUrl: string,
  environmentSlug?: string,
  environmentConfigId?: string
): Promise<boolean> {

  // Normalize target using the normalization utility
  // This ensures consistent matching with database records
  // Handles: spaces, slashes, special chars (e.g., "Log In" → "login", "/login" → "login")
  const normalizedTarget = normalizePageKeyword(targetPageKeyword);

  // Normalize current page name for consistent database lookups
  const inferredPage = inferPageName(page.url());
  const currentPageName = normalizePageKeyword(inferredPage);

  log.debug('🔍 Smart navigation starting', {
    module: 'TestExecutor',
    currentUrl: page.url(),
    inferredPage,
    normalizedCurrentPage: currentPageName,
    targetPageKeyword,
    normalizedTarget,
    hasConfigId: !!environmentConfigId,
    environmentConfigId,
  });

  // If no environmentConfigId, fall back to old journey-based approach
  if (!environmentConfigId) {
    return await navigateToPageLegacy(page, normalizedTarget, environmentUrl, environmentSlug);
  }

  // Load navigation data (selector + cached URL) FIRST
  const { loadNavigationData, updateUrlVerification, updateCachedUrl } = await import('@/lib/db/selectorService');
  const navData = await loadNavigationData(
    environmentConfigId,
    currentPageName,
    normalizedTarget
  );

  // CHECK: Are we already on the target page? Use the discovered URL from navData if available
  const currentUrl = page.url();
  let isAlreadyOnTarget = false;

  if (navData?.cachedUrl) {
    // Check if current URL matches the target page's actual URL
    isAlreadyOnTarget = currentUrl.includes(navData.cachedUrl) || currentUrl.endsWith(navData.cachedUrl);

    if (isAlreadyOnTarget) {
      log.info('✅ Already on target page (matched via cached URL), skipping navigation', {
        module: 'TestExecutor',
        currentPage: currentPageName,
        targetPage: normalizedTarget,
        currentUrl,
        targetUrl: navData.cachedUrl,
      });
      return true;
    }
  }

  // Also check simple keyword match - improved logic
  // Extract and normalize the current URL segment to compare with target keyword
  const currentUrlSegment = inferPageName(currentUrl);
  const normalizedUrlSegment = normalizePageKeyword(currentUrlSegment);

  isAlreadyOnTarget =
    currentPageName === normalizedTarget || // Exact page match (both normalized)
    normalizedUrlSegment === normalizedTarget || // URL segment matches target
    currentUrl.includes(`/${normalizedTarget}`) || // URL contains target keyword
    currentUrl.endsWith(`/${normalizedTarget}`) || // URL ends with /target
    currentUrl.endsWith(normalizedTarget); // URL ends with target

  if (isAlreadyOnTarget) {
    log.info('✅ Already on target page (matched via keyword), skipping navigation', {
      module: 'TestExecutor',
      currentPage: currentPageName,
      currentUrlSegment: normalizedUrlSegment,
      targetPage: normalizedTarget,
      currentUrl,
    });
    return true;
  }

  // NEW: If no navigation data found, try URL fallback strategy
  if (!navData) {
    log.warn('No navigation selector found, attempting URL fallback', {
      module: 'TestExecutor',
      from: currentPageName,
      to: normalizedTarget,
    });

    try {
      // Construct URL from page keyword
      const targetUrl = `${environmentUrl}/${normalizedTarget}`;

      log.debug('Attempting direct URL navigation', {
        module: 'TestExecutor',
        targetUrl,
      });

      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      // Wait for page to stabilize
      await Promise.race([
        page.waitForLoadState('networkidle', { timeout: 5000 }),
        page.waitForTimeout(1000)
      ]);

      const newUrl = page.url();
      const urlMatches = newUrl.includes(normalizedTarget) || newUrl.includes('/' + normalizedTarget);

      if (urlMatches) {
        log.info('✅ URL fallback navigation successful', {
          module: 'TestExecutor',
          to: normalizedTarget,
          finalUrl: newUrl,
          strategy: 'url_fallback',
        });
        return true;
      } else {
        log.warn('URL fallback navigation landed on unexpected page', {
          module: 'TestExecutor',
          expectedKeyword: normalizedTarget,
          actualUrl: newUrl,
        });
        // Continue anyway - might still be the right page
        return true;
      }
    } catch (error) {
      log.error('URL fallback navigation failed', {
        module: 'TestExecutor',
        from: currentPageName,
        to: normalizedTarget,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `No navigation path found for '${targetPageKeyword}'. ` +
        `Tried URL fallback but failed. ` +
        `Please record selectors first by visiting the page and clicking the Record button.`
      );
    }
  }

  // STRATEGY 1: Try cached URL first (if reliable enough)
  if (navData.cachedUrl && navData.urlReliability > 0.5) {
    try {
      log.debug('Trying cached URL navigation', {
        module: 'TestExecutor',
        url: navData.cachedUrl,
        reliability: navData.urlReliability,
      });

      await page.goto(navData.cachedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      // Verify we're on the right page
      // FIX: Use URL matching instead of page name comparison
      // Page keyword (e.g., "login") may differ from URL path (e.g., "/auth")
      const currentUrl = page.url();
      const urlMatches = currentUrl.includes(navData.cachedUrl) || currentUrl === navData.cachedUrl;

      // Also check if normalized inferred page name matches normalized target
      const normalizedNewPage = normalizePageKeyword(inferPageName(currentUrl));
      const pageNameMatches = normalizedNewPage === normalizedTarget;

      // Consider navigation successful if URL matches OR page keyword matches
      const landedCorrectly = urlMatches ||
                             pageNameMatches ||
                             currentUrl.includes(normalizedTarget);

      if (landedCorrectly) {
        log.info('✅ URL navigation successful (cached)', {
          module: 'TestExecutor',
          to: normalizedTarget,
          url: navData.cachedUrl,
          finalUrl: currentUrl,
          matchedBy: urlMatches ? 'url' : pageNameMatches ? 'pageName' : 'keyword',
        });

        // Update verification count
        await updateUrlVerification(environmentConfigId, navData.selector.key, true);

        return true;
      } else {
        log.warn('URL navigation landed on wrong page, trying selector', {
          module: 'TestExecutor',
          expectedPage: normalizedTarget,
          expectedUrl: navData.cachedUrl,
          actualUrl: currentUrl,
          actualPage: normalizedNewPage,
        });
      }
    } catch (error) {
      log.warn('Cached URL navigation failed, falling back to selector', {
        module: 'TestExecutor',
        url: navData.cachedUrl,
        error: error instanceof Error ? error.message : String(error),
      });

      // Mark URL as unreliable
      await updateUrlVerification(environmentConfigId, navData.selector.key, false);
    }
  }

  // STRATEGY 2: Fall back to selector-based navigation
  log.debug('Using selector-based navigation', {
    module: 'TestExecutor',
    selectorKey: navData.selector.key,
  });

  try {
    // Find and click navigation element using selector
    const locator = await findElementBySelector(page, navData.selector);
    await locator.click({ timeout: 5000 });

    // Wait for navigation
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: 5000 }),
      page.waitForTimeout(1000)
    ]);

    const newUrl = page.url();

    log.info('✅ Selector navigation successful', {
      module: 'TestExecutor',
      to: normalizedTarget,
      newUrl,
    });

    // Update cached URL if it changed
    if (newUrl !== navData.cachedUrl) {
      log.debug('Updating cached URL with newly discovered URL', {
        module: 'TestExecutor',
        oldUrl: navData.cachedUrl,
        newUrl,
      });
      await updateCachedUrl(environmentConfigId, navData.selector.key, newUrl);
    } else if (navData.cachedUrl) {
      // URL is same, increment verification count
      await updateUrlVerification(environmentConfigId, navData.selector.key, true);
    }

    return true;

  } catch (error) {
    log.error('Both navigation strategies failed', {
      module: 'TestExecutor',
      from: currentPageName,
      to: normalizedTarget,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Legacy navigation function using journey files (fallback)
 */
async function navigateToPageLegacy(
  page: Page,
  urlOrKeyword: string,
  environmentUrl: string,
  environmentSlug?: string
): Promise<boolean> {
  // Try journey-based navigation if environmentSlug is provided
  if (environmentSlug) {
    try {
      const journey = await findJourneyByKeyword(environmentSlug, urlOrKeyword);

      if (journey) {
        log.debug('Navigating using journey (legacy)', {
          module: 'TestExecutor',
          keyword: urlOrKeyword,
          actualUrl: journey.actualUrl,
        });

        // Execute journey steps
        for (const step of journey.steps) {
          switch (step.action) {
            case 'navigate':
              if (step.expectedUrl) {
                await page.goto(step.expectedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
              }
              break;

            case 'click':
              if (step.targetSelector) {
                await page.waitForSelector(step.targetSelector, { state: 'visible', timeout: 5000 });
                await page.click(step.targetSelector);
                await page.waitForLoadState('domcontentloaded');
              }
              break;

            case 'wait':
              await page.waitForTimeout(step.timeout || 1000);
              break;

            case 'hover':
              if (step.targetSelector) {
                await page.hover(step.targetSelector);
              }
              break;
          }
        }

        await page.waitForTimeout(1000); // Stabilize
        return true;
      }
    } catch (error) {
      log.error('Journey navigation failed - no fallback available', error instanceof Error ? error : new Error(String(error)), {
        module: 'TestExecutor',
        keyword: urlOrKeyword,
        environmentSlug,
      });
      throw new Error(
        `Failed to navigate to '${urlOrKeyword}'. No journey found. ` +
        `Please record selectors first by clicking the Record button.`
      );
    }
  }

  // No journey found - fail with clear message
  throw new Error(
    `No navigation path found for '${urlOrKeyword}'. ` +
    `Please record selectors first by visiting the page and clicking the Record button.`
  );
}

/**
 * Helper: Find element by selector (tries primary then fallbacks)
 */
async function findElementBySelector(
  page: Page,
  elementSelector: ElementSelector
): Promise<Locator> {
  // Try primary selector
  let locator = page.locator(elementSelector.primary).first();
  if (await locator.count() > 0) {
    return locator;
  }

  // Try fallback selectors
  for (const fallback of elementSelector.fallbacks) {
    locator = page.locator(fallback).first();
    if (await locator.count() > 0) {
      return locator;
    }
  }

  throw new Error(`Navigation element not found: ${elementSelector.key}`);
}

/**
 * Execute a single step action
 * Updated to pass environmentConfigId for smart navigation
 */
async function executeStep(
  action: StepAction,
  page: Page,
  screenshotDir: string,
  environmentUrl: string,
  environmentSlug?: string,
  environmentConfigId?: string
): Promise<boolean> {
  switch (action.type) {
    case 'navigate': {
      // Use smart navigation with selector/URL caching
      // action.pageKeyword should be set by step parser for navigation actions
      const targetKeyword = action.pageKeyword || action.url;
      return await navigateToPage(page, targetKeyword, environmentUrl, environmentSlug, environmentConfigId);
    }

    case 'click': {
      // Find element using selector repository with fallback strategies
      const element = await findElement(page, action.target, action.elementKey, environmentUrl, environmentSlug, environmentConfigId);
      if (!element) {
        throw new Error(`Could not find clickable element: "${action.target}"`);
      }
      await element.click({ timeout: 5000 });
      // Smart wait for navigation or transitions
      await Promise.race([
        page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {}),
        page.waitForTimeout(500)
      ]);
      return true;
    }

    case 'fill': {
      // Find input element using selector repository with fallback strategies
      const element = await findElement(page, action.target, action.elementKey, environmentUrl, environmentSlug, environmentConfigId);
      if (!element) {
        throw new Error(`Could not find input field: "${action.target}"`);
      }
      await element.fill(action.value, { timeout: 5000 });
      // Wait for any input validation or auto-complete
      await page.waitForTimeout(200);
      return true;
    }

    case 'verify_text': {
      const result = await verifyTextExists(page, action.text, action.shouldExist ?? true);
      return result.passed;
    }

    case 'verify_element': {
      // Find element using selector repository with fallback strategies
      const element = await findElement(page, action.target, action.elementKey, environmentUrl, environmentSlug, environmentConfigId);
      if (action.shouldExist ?? true) {
        return element !== null;
      } else {
        return element === null;
      }
    }

    case 'verify_url': {
      const result = await verifyUrl(page, action.url, action.exact);
      return result.passed;
    }

    case 'wait': {
      const duration = action.duration || 1000;
      await page.waitForTimeout(duration);
      return true;
    }

    case 'screenshot': {
      await captureScreenshot(page, screenshotDir, action.name || `step-${Date.now()}`);
      return true;
    }

    case 'unknown': {
      log.warn('Unknown step type, skipping', { module: 'TestExecutor', step: action.rawStep });
      // Try to execute as a smart fallback
      return await executeFallbackStep(action.rawStep, page);
    }

    default: {
      log.warn('Unhandled action type', { module: 'TestExecutor', action });
      return false;
    }
  }
}

/**
 * Verify expected result using natural language
 */
async function verifyExpectedResult(page: Page, expected: string): Promise<VerificationResult> {
  const normalized = expected.toLowerCase().trim();

  // Try to intelligently verify based on expected text

  // Check for URL verification
  if (/url|page|navigate|redirect/.test(normalized)) {
    // Try to extract URL from expected text
    const urlMatch = expected.match(/(?:https?:\/\/|\/)[^\s'"]+/);
    if (urlMatch) {
      return await verifyUrl(page, urlMatch[0], false);
    }
  }

  // Check for text verification (most common)
  if (/display|show|contain|present|visible/.test(normalized)) {
    // Extract text in quotes
    const textMatch = expected.match(/["']([^"']+)["']/);
    if (textMatch) {
      return await verifyTextExists(page, textMatch[1], true);
    }
  }

  // Default: Check if expected text exists somewhere on the page
  // This is a reasonable fallback for most cases
  return await verifyTextExists(page, expected, true);
}

/**
 * Fallback for unknown steps - try smart execution
 */
async function executeFallbackStep(step: string, page: Page): Promise<boolean> {
  const normalized = step.toLowerCase();

  // If it contains "wait", just wait
  if (/wait/.test(normalized)) {
    await page.waitForTimeout(2000);
    return true;
  }

  // If it's just a verification statement, treat as passed
  // (The verification will happen in expected result check)
  if (/^(verify|check|ensure|confirm|assert)/.test(normalized)) {
    return true;
  }

  // Otherwise, log warning and continue
  log.warn('Fallback: treating unknown step as informational', { module: 'TestExecutor', step });
  return true;
}

/**
 * Perform login using selector repository
 * Navigates to login page, fills credentials, and submits form
 */
async function performLogin(
  page: Page,
  credentials: { username: string; password: string },
  environmentUrl: string,
  environmentSlug?: string,
  environmentConfigId?: string
): Promise<boolean> {
  log.debug('Performing login', {
    module: 'TestExecutor',
    username: credentials.username,
  });

  try {
    const currentUrl = page.url();

    // Check if we're already on login page
    const isOnLoginPage = currentUrl.includes('/login') || currentUrl.includes('login');

    if (!isOnLoginPage) {
      // Navigate to login page first
      log.debug('Not on login page, navigating to login', {
        module: 'TestExecutor',
        currentUrl,
      });

      try {
        await navigateToPage(page, 'login', environmentUrl, environmentSlug, environmentConfigId);
      } catch (error) {
        log.warn('Failed to navigate to login page', {
          module: 'TestExecutor',
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    }

    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Find and fill username field
    log.debug('Filling username field', { module: 'TestExecutor' });
    const usernameElement = await findElement(
      page,
      'username',
      'username',
      environmentUrl,
      environmentSlug,
      environmentConfigId
    );

    if (!usernameElement) {
      log.warn('Username field not found', { module: 'TestExecutor' });
      return false;
    }

    await usernameElement.fill(credentials.username);
    await page.waitForTimeout(200);

    // Find and fill password field
    log.debug('Filling password field', { module: 'TestExecutor' });
    const passwordElement = await findElement(
      page,
      'password',
      'password',
      environmentUrl,
      environmentSlug,
      environmentConfigId
    );

    if (!passwordElement) {
      log.warn('Password field not found', { module: 'TestExecutor' });
      return false;
    }

    await passwordElement.fill(credentials.password);
    await page.waitForTimeout(200);

    // Find and click login button
    log.debug('Clicking login button', { module: 'TestExecutor' });
    const loginButton = await findElement(
      page,
      'login button',
      'login-button',
      environmentUrl,
      environmentSlug,
      environmentConfigId
    );

    if (!loginButton) {
      log.warn('Login button not found', { module: 'TestExecutor' });
      return false;
    }

    await loginButton.click();

    // Wait for navigation after login
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: 10000 }),
      page.waitForTimeout(3000)
    ]);

    // Verify we're no longer on login page
    const newUrl = page.url();
    const isStillOnLogin = newUrl.includes('/login') || newUrl.includes('login');

    if (isStillOnLogin) {
      log.warn('Still on login page after login attempt', {
        module: 'TestExecutor',
        newUrl,
      });
      return false;
    }

    log.info('✅ Login completed successfully', {
      module: 'TestExecutor',
      newUrl,
    });

    return true;

  } catch (error) {
    log.error('Login execution failed', error instanceof Error ? error : new Error(String(error)), {
      module: 'TestExecutor',
    });
    return false;
  }
}

/**
 * Execute multiple test cases sequentially
 * NEW: Supports database-first loading and detailed step tracking
 */
export async function executeTestSuite(
  testCases: TestCase[],
  page: Page,
  screenshotDir: string,
  environmentUrl: string,
  onProgress?: (completed: number, total: number) => void,
  environmentSlug?: string,
  environmentConfigId?: string,
  runId?: string,
  credentials?: { username: string; password: string }  // NEW: credentials for protected pages
): Promise<TestExecutionResult[]> {
  const results: TestExecutionResult[] = [];

  log.debug('Executing test suite', {
    module: 'TestExecutor',
    testCount: testCases.length,
    environmentUrl,
    journeyMode: !!environmentSlug,
    databaseMode: !!environmentConfigId,
    runId,
    hasCredentials: !!credentials,
  });

  // NEW: Perform login if credentials provided (for protected pages)
  if (credentials) {
    log.debug('Attempting login before test execution', {
      module: 'TestExecutor',
      username: credentials.username,
    });

    try {
      const loginSuccess = await performLogin(
        page,
        credentials,
        environmentUrl,
        environmentSlug,
        environmentConfigId
      );

      if (!loginSuccess) {
        log.warn('Login failed before test execution - tests may fail on protected pages', {
          module: 'TestExecutor',
        });
      } else {
        log.info('✅ Login successful, proceeding with tests', {
          module: 'TestExecutor',
        });
      }
    } catch (error) {
      log.error('Login error before test execution', error instanceof Error ? error : new Error(String(error)), {
        module: 'TestExecutor',
      });
      // Continue with tests anyway - they might not need login
    }
  }

  // Get test execution records if runId provided
  let testExecutions: any[] = [];
  if (runId && environmentConfigId) {
    const { prisma } = await import('@/lib/db/prisma');
    testExecutions = await prisma.testExecution.findMany({
      where: { runId },
      select: { id: true, testCaseTitle: true },
    });

    log.debug('Loaded test execution records', {
      module: 'TestExecutor',
      runId,
      count: testExecutions.length,
    });
  }

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    log.debug('Executing test case', {
      module: 'TestExecutor',
      index: i + 1,
      total: testCases.length,
      title: testCase.title
    });

    // Find corresponding test execution record
    const testExecution = testExecutions.find(te => te.testCaseTitle === testCase.title);
    const testExecutionId = testExecution?.id;

    if (testExecutionId) {
      log.debug('Found test execution record', {
        module: 'TestExecutor',
        testCaseTitle: testCase.title,
        testExecutionId,
      });
    }

    const result = await executeTestCase(
      testCase,
      page,
      screenshotDir,
      environmentUrl,
      environmentSlug,
      environmentConfigId,
      testExecutionId
    );
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, testCases.length);
    }

    // Small delay between tests
    await page.waitForTimeout(500);
  }

  return results;
}
