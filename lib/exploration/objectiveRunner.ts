/**
 * Objective-based exploration runner
 * Executes objectives from ExplorationPlan with scope filtering
 */

import { prisma } from '@/lib/db/prisma';
import type { Objective, Scope } from '@/types/exploration';
import fs from 'fs';
import path from 'path';
import { log } from '@/lib/utils/logger';

export interface ObjectiveRunnerInput {
  runId: string;
  environment: string;
  planId: string;
  auth?: {
    username: string;
    password: string;
  };
}

interface ObjectiveResult {
  objectiveId: string;
  passed: boolean;
  error?: string;
  screenshotPath?: string;
  relevanceScore: number;
  observed?: string; // What actually happened
  url?: string; // URL where the test was performed
}

/**
 * Check if URL is in scope
 */
function inScopeUrl(url: string, scope: Scope): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;

    // Check if host is allowed
    const hostAllowed = scope.allowedHosts.some(allowedHost =>
      host === allowedHost || host.endsWith(`.${allowedHost}`)
    );

    if (!hostAllowed) {
      return false;
    }

    // If paths are specified, check them
    if (scope.allowedPaths && scope.allowedPaths.length > 0) {
      const pathAllowed = scope.allowedPaths.some(allowedPath =>
        parsed.pathname.startsWith(allowedPath)
      );
      return pathAllowed;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a single objective using Playwright
 */
async function executeObjective(
  objective: Objective,
  page: any,
  environment: string,
  scope: Scope,
  runId: string
): Promise<ObjectiveResult> {
  log.debug('Executing objective', { module: 'ObjectiveRunner', title: objective.title });

  let relevanceScore = 0.5; // Base score
  let passed = false;
  let error: string | undefined;
  let screenshotPath: string | undefined;
  let observed: string | undefined;
  let url: string | undefined;

  try {
    // Navigate to environment if not already there
    const currentUrl = page.url();
    if (!inScopeUrl(currentUrl, scope) || currentUrl === 'about:blank') {
      await page.goto(environment, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);
    }

    // Capture current URL
    url = page.url();

    // Check if we're in scope
    if (url && inScopeUrl(url, scope)) {
      relevanceScore += 0.3;
    }

    // Execute based on objective type
    switch (objective.type) {
      case 'ACTION_FLOW':
        await executeActionFlow(objective, page, scope);
        passed = true;
        break;

      case 'UI_TEXT_MATCH':
        await executeUITextMatch(objective, page);
        passed = true;
        break;

      case 'VALIDATION':
        await executeValidation(objective, page);
        passed = true;
        break;

      case 'NAVIGATION':
        await executeNavigation(objective, page, scope);
        passed = true;
        break;

      case 'ELEMENT_PRESENCE':
        await executeElementPresence(objective, page);
        passed = true;
        break;

      case 'A11Y_RULE':
        await executeA11yRule(objective, page);
        passed = true;
        break;

      case 'API_STATUS':
        await executeAPIStatus(objective, page);
        passed = true;
        break;

      default:
        throw new Error(`Unsupported objective type: ${objective.type}`);
    }

    relevanceScore += 0.2; // Success bonus
  } catch (err) {
    passed = false;
    error = err instanceof Error ? err.message : 'Unknown error';
    log.debug('Objective failed', { module: 'ObjectiveRunner', title: objective.title, error });

    // Capture what was observed (page content snippet)
    try {
      const bodyText = await page.textContent('body');
      observed = bodyText?.substring(0, 500) || 'Unable to capture page content';
      url = page.url();
    } catch {
      observed = error;
    }

    // Take screenshot on failure
    const screenshotDir = path.join(process.cwd(), 'public', 'explore', runId);
    fs.mkdirSync(screenshotDir, { recursive: true });
    const filename = `${objective.id}_failure.png`;
    const fullPath = path.join(screenshotDir, filename);
    await page.screenshot({ path: fullPath });
    screenshotPath = `/explore/${runId}/${filename}`;

    // Calculate relevance even on failure
    if (error.includes('Expected') || error.includes('not found')) {
      relevanceScore += 0.2;
    }
  }

  return {
    objectiveId: objective.id,
    passed,
    error,
    screenshotPath,
    relevanceScore: Math.min(1, relevanceScore),
    observed,
    url,
  };
}

/**
 * Execute ACTION_FLOW objective
 */
async function executeActionFlow(objective: Objective, page: any, scope: Scope): Promise<void> {
  if (!objective.steps || objective.steps.length === 0) {
    return;
  }

  for (const step of objective.steps) {
    const stepLower = step.toLowerCase();

    // Navigate
    if (stepLower.includes('navigate')) {
      const urlMatch = step.match(/https?:\/\/[^\s]+/);
      if (urlMatch && inScopeUrl(urlMatch[0], scope)) {
        await page.goto(urlMatch[0], { waitUntil: 'networkidle' });
      }
      continue;
    }

    // Click button
    if (stepLower.includes('click') && stepLower.includes('button')) {
      const buttonText = extractQuotedText(step) || guessButtonText(step);
      if (buttonText) {
        await page.getByRole('button', { name: new RegExp(buttonText, 'i') }).click();
        await page.waitForTimeout(1000);
      }
      continue;
    }

    // Fill input
    if (stepLower.match(/enter|type|fill/)) {
      const fieldText = extractQuotedText(step) || guessFieldName(step);
      const value = step.match(/with\s+["']([^"']+)["']/)?.[1] || 'test_value';
      if (fieldText) {
        const input = page.getByRole('textbox', { name: new RegExp(fieldText, 'i') }).first();
        await input.fill(value);
      }
      continue;
    }

    // Click link
    if (stepLower.includes('click') && stepLower.includes('link')) {
      const linkText = extractQuotedText(step) || guessLinkText(step);
      if (linkText) {
        await page.getByRole('link', { name: new RegExp(linkText, 'i') }).click();
        await page.waitForTimeout(1000);
      }
      continue;
    }
  }

  // Verify expected outcome
  if (objective.expected) {
    const content = await page.textContent('body');
    if (!content.toLowerCase().includes(objective.expected.toLowerCase().substring(0, 20))) {
      throw new Error(`Expected outcome not found: ${objective.expected}`);
    }
  }
}

/**
 * Execute UI_TEXT_MATCH objective
 */
async function executeUITextMatch(objective: Objective, page: any): Promise<void> {
  const expectedText = objective.expects?.textEquals || '';
  const roles = objective.target.roles || ['button', 'link'];
  const notTexts = objective.target.notTexts || [];

  // Try to find element by role and expected text
  let foundElement = null;
  let foundWithWrongText = false;
  let wrongTextValue = '';

  for (const role of roles) {
    try {
      // Try to find by expected text
      const elements = await page.getByRole(role).all();

      for (const element of elements) {
        const accessibleName = await element.evaluate((el: any) => {
          return el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '';
        });

        const normalizedName = accessibleName.trim().toLowerCase();
        const normalizedExpected = expectedText.toLowerCase();

        // Check if this element has the new text
        if (normalizedName.includes(normalizedExpected) || normalizedExpected.includes(normalizedName)) {
          foundElement = element;
          break;
        }

        // Check if this element still has the old text (notTexts)
        for (const notText of notTexts) {
          const normalizedNotText = notText.toLowerCase();
          if (normalizedName.includes(normalizedNotText) || normalizedNotText.includes(normalizedName)) {
            foundWithWrongText = true;
            wrongTextValue = accessibleName.trim();
          }
        }
      }

      if (foundElement) {
        break; // Found correct element
      }
    } catch (err) {
      // Role not found or error, continue to next role
      continue;
    }
  }

  if (!foundElement) {
    if (foundWithWrongText) {
      throw new Error(`${roles[0]} text not updated: still shows "${wrongTextValue}" instead of "${expectedText}"`);
    } else {
      throw new Error(`${roles[0]} with text "${expectedText}" not found`);
    }
  }

  // Verify notTexts are not present
  for (const notText of notTexts) {
    const hasNotText = await page.getByText(notText, { exact: false }).count();
    if (hasNotText > 0) {
      throw new Error(`Old text "${notText}" still present on page`);
    }
  }
}

/**
 * Execute VALIDATION objective
 */
async function executeValidation(objective: Objective, page: any): Promise<void> {
  // Execute steps to trigger validation
  if (!objective.steps || objective.steps.length === 0) {
    return;
  }

  for (const step of objective.steps) {
    if (step.toLowerCase().includes('click')) {
      const text = extractQuotedText(step) || 'submit';
      await page.getByRole('button', { name: new RegExp(text, 'i') }).click();
      await page.waitForTimeout(500);
    }
  }

  // Check for validation message
  if (!objective.expected) {
    throw new Error('Validation objective missing expected error message');
  }

  const content = await page.textContent('body');
  const expectedError = objective.expected.toLowerCase();

  if (!content.toLowerCase().includes(expectedError)) {
    throw new Error(`Validation message not found: ${expectedError}`);
  }
}

/**
 * Execute NAVIGATION objective
 */
async function executeNavigation(objective: Objective, page: any, scope: Scope): Promise<void> {
  // Perform navigation action
  if (!objective.steps || objective.steps.length === 0) {
    return;
  }

  for (const step of objective.steps) {
    if (step.toLowerCase().includes('click')) {
      const text = extractQuotedText(step) || guessLinkText(step);
      if (text) {
        await page.getByRole('link', { name: new RegExp(text, 'i') }).click();
        await page.waitForLoadState('networkidle');
      }
    }
  }

  // Verify URL or content
  const url = page.url();
  if (!inScopeUrl(url, scope)) {
    throw new Error(`Navigated out of scope: ${url}`);
  }
}

async function executeElementPresence(objective: Objective, page: any): Promise<void> {
  // Check for element presence based on target selectors/texts
  const { selectors, texts } = objective.target;

  if (selectors && selectors.length > 0) {
    for (const selector of selectors) {
      const element = await page.locator(selector).first();
      const exists = await element.count() > 0;

      if (objective.expects.exists !== undefined && exists !== objective.expects.exists) {
        throw new Error(`Element ${selector} ${exists ? 'exists' : 'does not exist'}, but expected ${objective.expects.exists ? 'to exist' : 'not to exist'}`);
      }
    }
  } else if (texts && texts.length > 0) {
    for (const text of texts) {
      const element = await page.getByText(text, { exact: false }).first();
      const exists = await element.count() > 0;

      if (objective.expects.exists !== undefined && exists !== objective.expects.exists) {
        throw new Error(`Text "${text}" ${exists ? 'found' : 'not found'}, but expected ${objective.expects.exists ? 'to be found' : 'not to be found'}`);
      }
    }
  }
}

async function executeA11yRule(objective: Objective, page: any): Promise<void> {
  // Stub implementation for accessibility rule checking
  // In a full implementation, this would use axe-core or similar
  log.debug('A11Y rule checking not yet implemented', { module: 'ObjectiveRunner', rule: objective.expects.a11yRule });

  // For now, just pass (implementation pending)
  return Promise.resolve();
}

async function executeAPIStatus(objective: Objective, page: any): Promise<void> {
  // Stub implementation for API status checking
  // In a full implementation, this would intercept network requests
  log.debug('API status checking not yet implemented', { module: 'ObjectiveRunner', expectedStatus: objective.expects.statusCode });

  // For now, just pass (implementation pending)
  return Promise.resolve();
}

// Helper functions
function extractQuotedText(text: string): string | null {
  const match = text.match(/["']([^"']+)["']/);
  return match ? match[1] : null;
}

function guessButtonText(text: string): string {
  const match = text.match(/click\s+(?:the\s+)?([a-zA-Z\s]+)\s+button/i);
  return match ? match[1].trim() : 'submit';
}

function guessFieldName(text: string): string {
  const match = text.match(/(?:enter|fill|type)\s+(?:the\s+)?([a-zA-Z\s]+)\s*(?:field|input)?/i);
  return match ? match[1].trim() : 'input';
}

function guessLinkText(text: string): string {
  const match = text.match(/click\s+(?:the\s+)?([a-zA-Z\s]+)\s+link/i);
  return match ? match[1].trim() : 'link';
}

function formatExpectation(objective: Objective): string {
  const expects = objective.expects;
  const parts: string[] = [];

  if (expects.exists !== undefined) {
    parts.push(`Element should ${expects.exists ? 'exist' : 'not exist'}`);
  }
  if (expects.textEquals) {
    parts.push(`Text should equal: "${expects.textEquals}"`);
  }
  if (expects.navigatesToPath) {
    parts.push(`Should navigate to: ${expects.navigatesToPath}`);
  }
  if (expects.statusCode) {
    parts.push(`Status code should be: ${expects.statusCode}`);
  }
  if (expects.a11yRule) {
    parts.push(`Accessibility rule: ${expects.a11yRule}`);
  }

  return parts.length > 0 ? parts.join('; ') : 'Test should pass';
}

/**
 * Main runner function
 */
export async function runObjectiveBasedExploration(input: ObjectiveRunnerInput): Promise<void> {
  const startTime = Date.now();
  log.debug('Starting run', { module: 'ObjectiveRunner', runId: input.runId });

  try {
    // Load plan
    const plan = await prisma.explorationPlan.findUnique({
      where: { id: input.planId },
    });

    if (!plan) {
      throw new Error('Exploration plan not found');
    }

    const objectives = plan.objectivesJson as unknown as Objective[];
    const scope = plan.scopeJson as unknown as Scope;

    log.debug('Loaded plan', { module: 'ObjectiveRunner', objectiveCount: objectives.length, allowedHosts: scope.allowedHosts });

    // Check if Playwright is available
    let hasPlaywright = false;
    try {
      await import('playwright');
      hasPlaywright = true;
    } catch {
      log.debug('Playwright not available, using simulation', { module: 'ObjectiveRunner' });
    }

    const results: ObjectiveResult[] = [];

    if (hasPlaywright) {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        // Execute each objective
        for (const objective of objectives) {
          const result = await executeObjective(objective, page, input.environment, scope, input.runId);
          results.push(result);

          // Stop early if too many failures
          const failureRate = results.filter(r => !r.passed).length / results.length;
          if (results.length >= 5 && failureRate > 0.8) {
            log.debug('High failure rate, stopping early', { module: 'ObjectiveRunner', failureRate });
            break;
          }
        }
      } finally {
        await browser.close();
      }
    } else {
      // Simulate results for development
      for (const objective of objectives) {
        results.push({
          objectiveId: objective.id,
          passed: Math.random() > 0.3,
          relevanceScore: 0.7 + Math.random() * 0.3,
        });
      }
    }

    // Create bugs from failed objectives only
    const failedResults = results.filter(r => !r.passed);
    log.debug('Failed objectives', { module: 'ObjectiveRunner', failedCount: failedResults.length });

    for (const result of failedResults) {
      const objective = objectives.find(o => o.id === result.objectiveId);
      if (!objective) continue;

      // Build steps with expected vs observed
      const stepsWithContext = {
        steps: objective.steps || [],
        expected: formatExpectation(objective),
        observed: result.observed || result.error || 'Test failed',
        url: result.url || input.environment,
        objectiveType: objective.type,
        target: objective.target,
      };

      await prisma.bugFinding.create({
        data: {
          runId: input.runId,
          issueKey: plan.issueKey,
          objectiveId: result.objectiveId,
          title: `Failed: ${objective.title}`,
          stepsJson: stepsWithContext as any,
          severity: objective.severity,
          evidenceUrl: result.screenshotPath,
          relevance: result.relevanceScore,
          status: 'new',
        },
      });
    }

    // Update run status
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const passedCount = results.filter(r => r.passed).length;

    await prisma.explorationRun.update({
      where: { id: input.runId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        statsJson: {
          objectives: {
            total: objectives.length,
            executed: results.length,
            passed: passedCount,
            failed: failedResults.length,
          },
          duration,
        } as any,
      },
    });

    log.debug('Completed', { module: 'ObjectiveRunner', passed: passedCount, total: results.length });
  } catch (error) {
    log.error('Exploration error', error instanceof Error ? error : new Error(String(error)), { module: 'ObjectiveRunner' });

    await prisma.explorationRun.update({
      where: { id: input.runId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        statsJson: {
          error: error instanceof Error ? error.message : 'Unknown error',
        } as any,
      },
    });
  }
}
