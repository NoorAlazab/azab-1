import { prisma } from '@/lib/server/db/prisma';
import fs from 'fs';
import path from 'path';
import type { Page } from 'playwright';
import { log } from '@/lib/utils/logger';

export interface RunnerInput {
  runId: string;
  environment: string;
  storyKey: string;
  mode: 'smoke' | 'auth' | 'deep' | 'a11y';
  auth?: {
    username: string;
    password: string;
  };
  limits?: {
    maxPages?: number;
    maxMinutes?: number;
    userAgent?: string;
  };
  storyContext?: {
    summary: string;
    description: string;
    acceptanceCriteria: string;
    testScenarios: string[];
  };
}

export interface RunnerStats {
  pagesScanned: number;
  errorsFound: number;
  duration: number;
  error?: string;
}

/**
 * Main exploration runner
 * Uses Playwright if available, otherwise simulates findings for development
 */
export async function runExploration(input: RunnerInput): Promise<void> {
  const startTime = Date.now();
  let stats: RunnerStats = {
    pagesScanned: 0,
    errorsFound: 0,
    duration: 0,
  };

  try {
    // Check if Playwright is available
    const hasPlaywright = await checkPlaywrightAvailable();

    if (hasPlaywright) {
      stats = await runWithPlaywright(input);
    } else {
      // Fallback: simulate findings for development
      log.debug('Playwright not available, using simulation mode', { module: 'Runner' });
      stats = await runSimulation(input);
    }

    // Update run status to completed
    await prisma.explorationRun.update({
      where: { id: input.runId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        statsJson: stats as any,
      },
    });

  } catch (error) {
    log.error('Error in exploration', error instanceof Error ? error : new Error(String(error)), { module: 'Runner' });

    // Update run status to failed
    await prisma.explorationRun.update({
      where: { id: input.runId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        statsJson: {
          ...stats,
          error: error instanceof Error ? error.message : 'Unknown error',
        } as any,
      },
    });
  }
}

async function checkPlaywrightAvailable(): Promise<boolean> {
  try {
    await import('playwright');
    return true;
  } catch {
    return false;
  }
}

async function runWithPlaywright(input: RunnerInput): Promise<RunnerStats> {
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: input.limits?.userAgent,
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();
  const bugs: Array<{ title: string; severity: string; steps: string[]; screenshotPath?: string }> = [];
  const visitedUrls = new Set<string>();
  const maxPages = input.limits?.maxPages || 10;
  const maxMinutes = input.limits?.maxMinutes || 5;
  const timeoutMs = maxMinutes * 60 * 1000;
  const startTime = Date.now();

  // Screenshot directory
  const screenshotDir = path.join(process.cwd(), 'public', 'explore', input.runId);
  fs.mkdirSync(screenshotDir, { recursive: true });

  // Collect console errors
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Collect network errors
  const networkErrors: Array<{ url: string; status: number }> = [];
  page.on('response', response => {
    const status = response.status();
    if (status >= 400) {
      networkErrors.push({
        url: response.url(),
        status,
      });
    }
  });

  try {
    // Visit main environment URL
    log.debug('Visiting environment URL', { module: 'Runner', environment: input.environment });
    await page.goto(input.environment, { waitUntil: 'networkidle', timeout: 30000 });
    visitedUrls.add(input.environment);

    // Check for UI_TEXT_CHANGE intent from story context
    if (input.storyContext) {
      const { classifyIntent } = await import('./intent');
      const intent = classifyIntent(
        input.storyContext.summary,
        input.storyContext.description,
        input.storyContext.acceptanceCriteria
      );

      if (intent.intents[0] === 'UI_TEXT_CHANGE') {
        log.debug('Detected UI_TEXT_CHANGE intent, running focused verification', { module: 'Runner' });
        await runUITextChangeVerification(page, input, bugs, screenshotDir);

        // Skip other exploration modes for UI_TEXT_CHANGE
        await browser.close();

        // Save bugs to database
        for (const bug of bugs) {
          await prisma.bugFinding.create({
            data: {
              runId: input.runId,
              issueKey: input.storyKey,
              title: bug.title,
              stepsJson: bug.steps,
              severity: bug.severity,
              evidenceUrl: bug.screenshotPath,
              status: 'new',
              relevance: 0.9, // High relevance for focused verification
            },
          });
        }

        const duration = Math.floor((Date.now() - startTime) / 1000);
        return {
          pagesScanned: visitedUrls.size,
          errorsFound: bugs.length,
          duration,
        };
      }
    }

    // Attempt login if auth provided
    if (input.mode === 'auth' && input.auth?.username && input.auth?.password) {
      log.debug('Attempting login', { module: 'Runner' });
      const loginSuccess = await attemptLogin(page, input.auth);
      if (!loginSuccess) {
        bugs.push({
          title: 'Login flow not found or failed',
          severity: 'S2',
          steps: ['Navigate to environment URL', 'Look for login form', 'Login form not detected or login failed'],
        });
      }
    }

    // Crawl pages based on mode
    if (input.mode === 'deep') {
      await deepCrawl(page, input.environment, visitedUrls, maxPages, timeoutMs, startTime);
    } else if (input.mode === 'smoke') {
      // Just scan the main page
      await page.waitForTimeout(2000);
    }

    // Run accessibility checks if mode is a11y
    if (input.mode === 'a11y') {
      try {
        const { AxeBuilder } = await import('@axe-core/playwright');
        const results = await new AxeBuilder({ page }).analyze();

        for (const violation of results.violations.slice(0, 5)) {
          bugs.push({
            title: `A11y: ${violation.help}`,
            severity: violation.impact === 'critical' ? 'S0' : violation.impact === 'serious' ? 'S1' : 'S2',
            steps: [
              `Navigate to ${page.url()}`,
              `${violation.description}`,
              `Affected elements: ${violation.nodes.length}`,
            ],
          });
        }
      } catch (err) {
        bugs.push({
          title: 'Accessibility scan not configured',
          severity: 'S3',
          steps: ['Install @axe-core/playwright for a11y scanning'],
        });
      }
    }

  } finally {
    await browser.close();
  }

  // Use AI-powered bug analysis if story context is available
  log.debug('Story context check', {
    module: 'Runner',
    hasStoryContext: !!input.storyContext,
    hasSummary: !!input.storyContext?.summary,
    testScenariosCount: input.storyContext?.testScenarios.length || 0,
    consoleErrorsCount: consoleErrors.length,
    networkErrorsCount: networkErrors.length,
  });

  // Use AI if we have story summary (even without explicit test scenarios)
  if (input.storyContext && input.storyContext.summary) {
    log.debug('Using AI bug analysis with story context', { module: 'Runner' });

    // If no test scenarios provided, create one from the summary
    const testScenarios = input.storyContext.testScenarios.length > 0
      ? input.storyContext.testScenarios
      : [`Verify: ${input.storyContext.summary}`];

    log.debug('Test scenarios for AI', { module: 'Runner', testScenarios });

    try {
      // Create exploration log from visited pages
      const explorationLog = Array.from(visitedUrls).map((url, i) => `${i + 1}. Visited ${url}`).join('\n');

      // Prepare exploration results for AI analysis
      const explorationResults: any = {
        testScenarios: testScenarios,
        actions: Array.from(visitedUrls).map(url => ({
          type: 'navigate',
          target: url,
          timestamp: new Date().toISOString(),
          success: true,
        })),
        consoleErrors: consoleErrors.map(msg => ({
          message: msg,
          timestamp: new Date().toISOString(),
        })),
        failedRequests: networkErrors.map(err => ({
          url: err.url,
          status: err.status,
          timestamp: new Date().toISOString(),
        })),
        screenshots: [],
      };

      // Use AI to detect bugs with story context
      const { analyzeBugs } = await import('@/lib/server/ai/client');
      log.debug('Calling AI analyzeBugs', {
        module: 'Runner',
        scenariosCount: testScenarios.length,
        consoleErrorsCount: consoleErrors.length,
        failedRequestsCount: networkErrors.length,
      });

      const aiBugs = await analyzeBugs(
        testScenarios,
        explorationLog,
        consoleErrors,
        networkErrors.map(e => `${e.url} (${e.status})`)
      );

      log.debug('AI analysis completed', { module: 'Runner', bugsFound: aiBugs.length });

      // Convert AI bugs to our format
      for (const aiBug of aiBugs) {
        const severityMap: { [key: string]: string } = {
          critical: 'S0',
          high: 'S1',
          medium: 'S2',
          low: 'S3',
        };

        bugs.push({
          title: aiBug.title,
          severity: severityMap[aiBug.severity] || 'S2',
          steps: [
            `Story: ${input.storyContext.summary}`,
            `Test scenario: ${testScenarios[0]}`,
            aiBug.description,
          ],
        });
      }

      log.debug('AI analysis found relevant bugs', { module: 'Runner', bugCount: aiBugs.length });
    } catch (error) {
      log.error('AI bug analysis failed, falling back to simple detection', error instanceof Error ? error : new Error(String(error)), { module: 'Runner' });

      // Fallback: Create bugs from collected errors
      const screenshotDir = path.join(process.cwd(), 'public', 'explore', input.runId);
      fs.mkdirSync(screenshotDir, { recursive: true });

      for (const error of consoleErrors.slice(0, 5)) {
        bugs.push({
          title: `Console error: ${error.substring(0, 80)}`,
          severity: 'S2',
          steps: [
            'Navigate to page',
            'Open browser console',
            `Error: ${error}`,
          ],
        });
      }

      for (const netError of networkErrors.slice(0, 5)) {
        bugs.push({
          title: `HTTP ${netError.status} on ${netError.url}`,
          severity: netError.status >= 500 ? 'S1' : 'S2',
          steps: [
            `Navigate to page`,
            `Request to ${netError.url}`,
            `Received ${netError.status} status`,
          ],
        });
      }
    }
  } else {
    // No story context, use simple bug detection
    log.debug('No story context available, using simple bug detection', { module: 'Runner' });

    const screenshotDir = path.join(process.cwd(), 'public', 'explore', input.runId);
    fs.mkdirSync(screenshotDir, { recursive: true });

    for (const error of consoleErrors.slice(0, 5)) {
      bugs.push({
        title: `Console error: ${error.substring(0, 80)}`,
        severity: 'S2',
        steps: [
          'Navigate to page',
          'Open browser console',
          `Error: ${error}`,
        ],
      });
    }

    for (const netError of networkErrors.slice(0, 5)) {
      bugs.push({
        title: `HTTP ${netError.status} on ${netError.url}`,
        severity: netError.status >= 500 ? 'S1' : 'S2',
        steps: [
          `Navigate to page`,
          `Request to ${netError.url}`,
          `Received ${netError.status} status`,
        ],
      });
    }
  }

  // Save bugs to database
  for (const bug of bugs) {
    await prisma.bugFinding.create({
      data: {
        runId: input.runId,
        issueKey: input.storyKey,
        title: bug.title,
        stepsJson: bug.steps,
        severity: bug.severity,
        evidenceUrl: bug.screenshotPath,
        status: 'new',
      },
    });
  }

  const duration = Math.floor((Date.now() - startTime) / 1000);

  return {
    pagesScanned: visitedUrls.size,
    errorsFound: bugs.length,
    duration,
  };
}

async function attemptLogin(page: any, auth: { username: string; password: string }): Promise<boolean> {
  try {
    // Common login selectors
    const usernameSelectors = ['#username', '#email', 'input[name="username"]', 'input[name="email"]', 'input[type="email"]'];
    const passwordSelectors = ['#password', 'input[name="password"]', 'input[type="password"]'];
    const submitSelectors = ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Login")', 'button:has-text("Sign in")'];

    let usernameField = null;
    for (const selector of usernameSelectors) {
      try {
        usernameField = await page.locator(selector).first();
        if (await usernameField.isVisible({ timeout: 1000 })) break;
      } catch { }
    }

    let passwordField = null;
    for (const selector of passwordSelectors) {
      try {
        passwordField = await page.locator(selector).first();
        if (await passwordField.isVisible({ timeout: 1000 })) break;
      } catch { }
    }

    if (!usernameField || !passwordField) {
      return false;
    }

    await usernameField.fill(auth.username);
    await passwordField.fill(auth.password);

    for (const selector of submitSelectors) {
      try {
        const submitBtn = await page.locator(selector).first();
        if (await submitBtn.isVisible({ timeout: 1000 })) {
          await submitBtn.click();
          await page.waitForLoadState('networkidle', { timeout: 10000 });
          return true;
        }
      } catch { }
    }

    return false;
  } catch (err) {
    log.error('Login attempt failed', err instanceof Error ? err : new Error(String(err)), { module: 'Runner' });
    return false;
  }
}

async function deepCrawl(page: any, baseUrl: string, visitedUrls: Set<string>, maxPages: number, timeoutMs: number, startTime: number): Promise<void> {
  if (visitedUrls.size >= maxPages || Date.now() - startTime > timeoutMs) {
    return;
  }

  try {
    // Find all links on current page
    const links = await page.locator('a[href]').all();
    const urls: string[] = [];

    for (const link of links.slice(0, 20)) {
      try {
        const href = await link.getAttribute('href');
        if (href) {
          const url = new URL(href, baseUrl);
          if (url.origin === new URL(baseUrl).origin && !visitedUrls.has(url.href)) {
            urls.push(url.href);
          }
        }
      } catch { }
    }

    // Visit each link
    for (const url of urls) {
      if (visitedUrls.size >= maxPages || Date.now() - startTime > timeoutMs) {
        break;
      }

      if (!visitedUrls.has(url)) {
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
          visitedUrls.add(url);
          await page.waitForTimeout(1000);
        } catch (err) {
          log.debug('Failed to visit URL', { module: 'Runner', url, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  } catch (err) {
    log.error('Deep crawl error', err instanceof Error ? err : new Error(String(err)), { module: 'Runner' });
  }
}

/**
 * Run focused UI text change verification
 * Domain-scope only, discovers login paths, validates label change
 */
async function runUITextChangeVerification(
  page: Page,
  input: RunnerInput,
  bugs: Array<{ title: string; severity: string; steps: string[]; screenshotPath?: string }>,
  screenshotDir: string
): Promise<void> {
  log.debug('Starting focused verification', { module: 'UITextChange' });

  if (!input.storyContext) {
    log.error('No story context provided', { module: 'UITextChange' });
    return;
  }

  // Extract label change terms
  const { extractLabelChange } = await import('./intent');
  const { fromTerms, toTerms } = extractLabelChange(
    input.storyContext.summary,
    input.storyContext.description,
    input.storyContext.acceptanceCriteria
  );

  if (toTerms.length === 0) {
    log.error('No target terms extracted', { module: 'UITextChange' });
    bugs.push({
      title: 'Unable to extract target text from story',
      severity: 'S3',
      steps: [
        `Story: ${input.storyContext.summary}`,
        'Could not identify target text for verification',
        'Please ensure story clearly specifies the new text',
      ],
    });
    return;
  }

  log.debug('Extracted terms', { module: 'UITextChange', toTerms, fromTerms });

  // Discover login paths
  const { discoverLoginPaths, dismissBanners, isSameOrigin, isThirdPartySSO } = await import('./pageDiscovery');
  const paths = await discoverLoginPaths(page, input.environment);

  if (paths.length === 0) {
    log.debug('No login paths discovered, trying base URL', { module: 'UITextChange' });
    paths.push(input.environment);
  }

  log.debug('Checking paths', { module: 'UITextChange', pathCount: paths.length });

  const { collectCandidates } = await import('./locators');
  const { decideLabelChange } = await import('./passfail');

  let foundPass = false;
  const allCandidates: any[] = [];
  const visitedPaths: string[] = [];

  for (const targetPath of paths) {
    // Skip third-party SSO
    if (isThirdPartySSO(targetPath)) {
      log.debug('Skipping third-party SSO', { module: 'UITextChange', path: targetPath });
      continue;
    }

    // Only same-origin
    if (!isSameOrigin(targetPath, input.environment)) {
      log.debug('Skipping different origin', { module: 'UITextChange', path: targetPath });
      continue;
    }

    try {
      log.debug('Checking path', { module: 'UITextChange', path: targetPath });
      await page.goto(targetPath, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000);

      // Dismiss banners
      await dismissBanners(page);

      // Collect candidates
      const candidates = await collectCandidates(page);
      log.debug('Found candidates', { module: 'UITextChange', count: candidates.length, path: targetPath });

      // Store all candidates for evidence
      allCandidates.push(...candidates.slice(0, 5).map(c => ({
        ...c,
        url: targetPath,
      })));

      // Decide pass/fail
      const result = decideLabelChange({ candidates, fromTerms, toTerms });

      log.debug('Decision result', { module: 'UITextChange', pass: result.pass, reason: result.reason });

      if (result.pass) {
        // PASS: Log success and stop
        log.debug('PASS - Found target text', { module: 'UITextChange', path: targetPath });
        bugs.push({
          title: `✓ UI Text Change Verified: "${toTerms[0]}" found`,
          severity: 'S3', // Low severity = passed check
          steps: [
            `Story: ${input.storyContext.summary}`,
            `Expected: Button/link with text "${toTerms[0]}"`,
            `Observed: Found "${result.primaryName}" as primary CTA`,
            `URL: ${targetPath}`,
            `Status: PASS`,
          ],
        });
        foundPass = true;
        visitedPaths.push(targetPath);
        break; // Stop checking more paths
      } else {
        visitedPaths.push(targetPath);
      }

    } catch (error) {
      log.error('Error checking path', error instanceof Error ? error : new Error(String(error)), { module: 'UITextChange', path: targetPath });
    }
  }

  // If no PASS found after all paths, create FAIL bug
  if (!foundPass) {
    log.debug('FAIL - Target text not found on any path', { module: 'UITextChange' });

    // Take screenshot of last checked path
    let screenshotPath: string | undefined;
    try {
      const screenshotFilename = `fail-${Date.now()}.png`;
      screenshotPath = path.join(screenshotDir, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      screenshotPath = `/explore/${input.runId}/${screenshotFilename}`;
    } catch (err) {
      log.error('Screenshot failed', err instanceof Error ? err : new Error(String(err)), { module: 'UITextChange' });
    }

    // Get final candidates from last path
    const finalCandidates = allCandidates.slice(-5);

    // Determine specific failure reason
    let failureReason = '';
    let expectedVsObserved = '';

    if (finalCandidates.length === 0) {
      failureReason = 'No CTA candidates found on any checked path';
      expectedVsObserved = `Expected: Button/link with text "${toTerms[0]}"\nObserved: No buttons or links found`;
    } else {
      const primaryCandidate = finalCandidates[0];
      const hasLegacy = fromTerms.some(term =>
        finalCandidates.some(c => c.normalizedName === term.toLowerCase())
      );

      if (hasLegacy) {
        failureReason = `Primary CTA still shows legacy text "${primaryCandidate.name}" instead of "${toTerms[0]}"`;
        expectedVsObserved = `Expected: "${toTerms[0]}"\nObserved: "${primaryCandidate.name}" (legacy text still present)`;
      } else {
        failureReason = `Target text "${toTerms[0]}" not found on any checked path`;
        expectedVsObserved = `Expected: "${toTerms[0]}"\nObserved: No matching CTA found. Primary CTA is "${primaryCandidate.name}"`;
      }
    }

    bugs.push({
      title: `UI Text Change Failed: "${toTerms[0]}" not found`,
      severity: 'S2',
      steps: [
        `Story: ${input.storyContext.summary}`,
        `Paths checked: ${visitedPaths.join(', ')}`,
        failureReason,
        expectedVsObserved,
        `Candidates found: ${finalCandidates.map(c => `"${c.name}" (${c.role})`).join(', ')}`,
        `Screenshot: ${screenshotPath || 'N/A'}`,
      ],
      screenshotPath,
    });
  }
}

async function runSimulation(input: RunnerInput): Promise<RunnerStats> {
  log.debug('Simulating exploration', { module: 'Runner', environment: input.environment });

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Create simulated bugs
  const simulatedBugs = [
    {
      title: '[Demo] Console error on page load',
      severity: 'S2',
      steps: [
        `Navigate to ${input.environment}`,
        'Open browser console',
        'TypeError: Cannot read property "name" of undefined',
      ],
    },
    {
      title: '[Demo] HTTP 404 on missing resource',
      severity: 'S2',
      steps: [
        'Load main page',
        'Request to /api/missing-resource',
        'Received 404 status',
      ],
    },
  ];

  if (input.mode === 'a11y') {
    simulatedBugs.push({
      title: '[Demo] Missing alt text on images',
      severity: 'S2',
      steps: [
        `Navigate to ${input.environment}`,
        'Scan for accessibility issues',
        'Found 3 images without alt attributes',
      ],
    });
  }

  // Save simulated bugs
  for (const bug of simulatedBugs) {
    await prisma.bugFinding.create({
      data: {
        runId: input.runId,
        issueKey: input.storyKey,
        title: bug.title,
        stepsJson: bug.steps,
        severity: bug.severity,
        status: 'new',
      },
    });
  }

  return {
    pagesScanned: input.mode === 'deep' ? 5 : 1,
    errorsFound: simulatedBugs.length,
    duration: 3,
  };
}
