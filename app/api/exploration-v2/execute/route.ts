import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/iron';
import { prisma } from '@/lib/db/prisma';
import { executeTestSuite, type TestCase } from '@/lib/exploration/testExecutor';
import { generatePlaceholderScreenshot } from '@/lib/utils/placeholderScreenshot';
import { normalizeEnvironmentUrl } from '@/lib/exploration/environmentManager';
import { log } from '@/lib/utils/logger';
import path from 'path';

export const maxDuration = 300; // 5 minutes max

interface ExecuteRequest {
  runId: string;
  testCases: TestCase[];
  environment: string;
}

/**
 * Execute test cases for an exploration run
 * This runs the test cases using Playwright and stores results in database
 */
export async function POST(request: NextRequest) {
  console.log('========================================');
  console.log('[ExecuteAPI] POST REQUEST RECEIVED');
  console.log('[ExecuteAPI] Timestamp:', new Date().toISOString());
  console.log('========================================');

  try {
    log.debug('Execute request received', { module: 'ExplorationExecute' });

    // Require authentication
    const userId = await requireUserId();
    console.log('[ExecuteAPI] User authenticated, userId:', userId);

    // Parse request
    const body: ExecuteRequest = await request.json();
    const { runId, testCases, environment } = body;

    console.log('[ExecuteAPI] Request body parsed:', {
      runId,
      testCasesCount: testCases?.length,
      environment,
    });

    log.debug('Execute parameters', {
      module: 'ExplorationExecute',
      runId,
      testCasesCount: testCases.length,
      environment,
    });

    // Verify run belongs to user
    const run = await prisma.explorationRun.findFirst({
      where: {
        id: runId,
        userId,
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found or access denied' },
        { status: 404 }
      );
    }

    // Check if Playwright module is available (just check the module, not launch browser yet)
    let hasPlaywright = false;
    try {
      await import('playwright');
      hasPlaywright = true;
      log.debug('Playwright module available', { module: 'ExplorationExecute' });
    } catch (error) {
      log.warn('Playwright module not available, will use simulation', {
        module: 'ExplorationExecute',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // For now, use real execution if Playwright is available
    const forceSimulation = false;

    if (!hasPlaywright || forceSimulation) {
      console.log('[ExecuteAPI] Using simulated execution mode');
      log.warn('Using simulated execution mode', {
        module: 'ExplorationExecute',
        hasPlaywright,
        forceSimulation,
        reason: !hasPlaywright ? 'Playwright not available' : 'Forced simulation',
      });
      // Simulation mode for development
      return await runSimulatedExecution(runId, testCases, environment);
    }

    console.log('[ExecuteAPI] Playwright available, will use real browser execution');

    // Update run status
    await prisma.explorationRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Create test execution records
    log.debug('Creating test execution records', { module: 'ExplorationExecute', runId, count: testCases.length });
    for (const testCase of testCases) {
      const execution = await prisma.testExecution.create({
        data: {
          runId,
          testCaseId: testCase.id,
          testCaseTitle: testCase.title,
          testCaseSteps: testCase.steps,
          expectedResult: testCase.expected,
          priority: testCase.priority,
          type: testCase.type,
          status: 'pending',
        },
      });
      log.debug('Created test execution', { module: 'ExplorationExecute', executionId: execution.id, title: testCase.title });
    }
    log.debug('All test execution records created', { module: 'ExplorationExecute', runId });

    // Execute tests using Playwright (async)
    console.log('[ExecuteAPI] About to start async execution for runId:', runId);
    console.log('[ExecuteAPI] Test cases count:', testCases.length);
    console.log('[ExecuteAPI] Environment:', environment);
    log.debug('About to start async execution', { module: 'ExplorationExecute', runId });

    executeTestsAsync(runId, testCases, environment, userId)
      .then(() => {
        console.log('[ExecuteAPI] ✅ Async execution completed successfully');
        log.debug('Test execution completed successfully', { module: 'ExplorationExecute', runId });
      })
      .catch(async (error) => {
        console.error('[ExecuteAPI] Async execution failed:', error);
        log.error('Test execution failed with error', error instanceof Error ? error : new Error(String(error)), {
          module: 'ExplorationExecute',
          runId,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });

        // Mark all pending test executions as errored
        try {
          await prisma.testExecution.updateMany({
            where: {
              runId,
              status: 'pending',
            },
            data: {
              status: 'error',
              errorMessage: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
              finishedAt: new Date(),
            },
          });

          await prisma.explorationRun.update({
            where: { id: runId },
            data: {
              status: 'failed',
              finishedAt: new Date(),
            },
          });
        } catch (dbError) {
          console.error('[ExecuteAPI] Failed to update error status in database:', dbError);
        }
      });

    return NextResponse.json({ ok: true, runId });

  } catch (error) {
    log.error('Execute request failed', error instanceof Error ? error : new Error(String(error)), {
      module: 'ExplorationExecute',
    });
    return NextResponse.json(
      { error: 'Failed to execute tests' },
      { status: 500 }
    );
  }
}

/**
 * Execute tests asynchronously using Playwright
 */
async function executeTestsAsync(
  runId: string,
  testCases: TestCase[],
  environment: string,
  userId: string
) {
  console.log('[ExecuteAsync] ========== STARTING ASYNC EXECUTION ==========');
  console.log('[ExecuteAsync] RunID:', runId);
  console.log('[ExecuteAsync] Test Cases Count:', testCases.length);
  console.log('[ExecuteAsync] Environment:', environment);

  log.debug('Starting async test execution', {
    module: 'ExplorationExecute',
    runId,
    testCaseCount: testCases.length,
    environment,
  });

  let browser: any = null;

  try {
    console.log('[ExecuteAsync] Importing Playwright...');
    log.debug('Importing Playwright', { module: 'ExplorationExecute' });
    const { chromium } = await import('playwright');
    console.log('[ExecuteAsync] Playwright imported successfully');

    console.log('[ExecuteAsync] Launching browser...');
    log.debug('Launching browser', { module: 'ExplorationExecute' });
    browser = await chromium.launch({
      headless: false,  // Show browser window to user
      slowMo: 300,      // Slow down actions for visibility (300ms delay)
    });
    console.log('[ExecuteAsync] Browser launched with visible window');

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    console.log('[ExecuteAsync] Browser page created');

    const screenshotDir = path.join(process.cwd(), 'public', 'explore', runId);

    // Calculate environmentSlug for journey-based navigation
    const environmentSlug = normalizeEnvironmentUrl(environment);
    console.log('[ExecuteAsync] Environment slug:', environmentSlug);
    log.debug('Using environment slug for journeys', {
      module: 'ExplorationExecute',
      runId,
      environment,
      environmentSlug,
    });

    // Get environmentConfigId for database-first selector loading
    const { getEnvironmentConfig } = await import('@/lib/exploration/environmentManager');
    const envConfig = await getEnvironmentConfig(userId, environment);
    const environmentConfigId = envConfig?.id;

    console.log('[ExecuteAsync] Environment config ID:', environmentConfigId);
    log.debug('Using environment config for database selector loading', {
      module: 'ExplorationExecute',
      runId,
      environmentConfigId,
      hasConfig: !!envConfig,
    });

    // NEW: Retrieve and decrypt credentials if available
    let credentials: { username: string; password: string } | undefined;
    if (envConfig?.usernameEncrypted && envConfig?.passwordEncrypted) {
      try {
        console.log('[ExecuteAsync] Decrypting stored credentials for protected pages');
        log.debug('Decrypting credentials', { module: 'ExplorationExecute', runId });

        const { decryptCredentials } = await import('@/lib/crypto/credentials');
        credentials = decryptCredentials(envConfig.usernameEncrypted, envConfig.passwordEncrypted);

        console.log('[ExecuteAsync] Credentials decrypted, username:', credentials.username);
        log.debug('Credentials available for login', {
          module: 'ExplorationExecute',
          runId,
          hasUsername: !!credentials.username,
          hasPassword: !!credentials.password,
        });
      } catch (error) {
        console.warn('[ExecuteAsync] Failed to decrypt credentials:', error);
        log.warn('Failed to decrypt credentials - tests may fail on protected pages', {
          module: 'ExplorationExecute',
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      console.log('[ExecuteAsync] No stored credentials found');
      log.debug('No credentials available - protected pages may fail', {
        module: 'ExplorationExecute',
        runId,
      });
    }

    // Navigate to environment
    console.log('[ExecuteAsync] Navigating to environment:', environment);
    log.debug('Navigating to environment', { module: 'ExplorationExecute', environment });
    await page.goto(environment, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('[ExecuteAsync] Navigation completed');

    // Execute test suite with environment URL, slug, and configId
    log.debug('Starting test suite execution', { module: 'ExplorationExecute', runId, hasCredentials: !!credentials });
    const results = await executeTestSuite(
      testCases,
      page,
      screenshotDir,
      environment,
      (completed, total) => {
        log.debug('Test progress', {
          module: 'ExplorationExecute',
          runId,
          completed,
          total,
        });
      },
      environmentSlug, // Pass environmentSlug for journey-based navigation
      environmentConfigId, // Pass environmentConfigId for database-first selector loading
      runId, // Pass runId to link test executions to steps
      credentials // NEW: Pass credentials for login on protected pages
    );

    log.debug('Test suite execution completed', {
      module: 'ExplorationExecute',
      runId,
      resultsCount: results.length,
      statuses: results.map(r => ({ title: r.testCase.title, status: r.status })),
    });

    // Save results to database
    let passedCount = 0;
    let failedCount = 0;
    let errorCount = 0;

    log.debug('Saving results to database', { module: 'ExplorationExecute', runId, resultsCount: results.length });
    console.log('[ExecuteAsync] ========== SAVING RESULTS TO DATABASE ==========');
    console.log('[ExecuteAsync] Total results to save:', results.length);

    for (const result of results) {
      console.log('[ExecuteAsync] Processing result for:', result.testCase.title);
      console.log('[ExecuteAsync]   Status from executor:', result.status);
      console.log('[ExecuteAsync]   Has error:', !!result.error);
      console.log('[ExecuteAsync]   Error message:', result.error?.substring(0, 100));

      // Find the test execution record
      const execution = await prisma.testExecution.findFirst({
        where: {
          runId,
          testCaseTitle: result.testCase.title,
        },
      });

      if (execution) {
        console.log('[ExecuteAsync]   Found existing execution:', execution.id);
        console.log('[ExecuteAsync]   Current DB status:', execution.status);
        console.log('[ExecuteAsync]   Will update to:', result.status);

        log.debug('Updating test execution', {
          module: 'ExplorationExecute',
          executionId: execution.id,
          title: result.testCase.title,
          oldStatus: execution.status,
          newStatus: result.status,
        });

        const updated = await prisma.testExecution.update({
          where: { id: execution.id },
          data: {
            status: result.status,
            actualResult: result.verification?.observed,
            errorMessage: result.error,
            screenshotUrl: result.screenshotPath,
            executionLog: result.steps as any,
            duration: result.duration,
            finishedAt: new Date(),
          },
        });

        console.log('[ExecuteAsync]   ✅ UPDATED! New status in DB:', updated.status);

        // Verify the update by re-querying
        const verified = await prisma.testExecution.findUnique({
          where: { id: execution.id },
          select: { id: true, status: true, testCaseTitle: true }
        });
        console.log('[ExecuteAsync]   ✅ VERIFICATION: Re-queried status:', verified?.status);

      } else {
        console.log('[ExecuteAsync]   ⚠️ NO EXECUTION RECORD FOUND for:', result.testCase.title);
        log.warn('Test execution record not found', {
          module: 'ExplorationExecute',
          runId,
          title: result.testCase.title,
        });
      }

      if (result.status === 'passed') passedCount++;
      else if (result.status === 'failed') failedCount++;
      else errorCount++;
    }

    console.log('[ExecuteAsync] ========== FINISHED SAVING ALL RESULTS ==========');
    console.log('[ExecuteAsync] Summary - Passed:', passedCount, 'Failed:', failedCount, 'Errors:', errorCount);

    log.debug('All test executions updated', {
      module: 'ExplorationExecute',
      runId,
      total: testCases.length,
      passed: passedCount,
      failed: failedCount,
      errors: errorCount,
    });

    // Update run status and stats
    await prisma.explorationRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        statsJson: {
          total: testCases.length,
          passed: passedCount,
          failed: failedCount,
          errors: errorCount,
        },
      },
    });

    log.debug('Exploration run marked as completed', { module: 'ExplorationExecute', runId });

  } catch (error) {
    console.error('[ExecuteAsync] ========== ERROR IN ASYNC EXECUTION ==========');
    console.error('[ExecuteAsync] Error:', error);
    console.error('[ExecuteAsync] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[ExecuteAsync] Error stack:', error instanceof Error ? error.stack : 'N/A');

    log.error('Test execution error', error instanceof Error ? error : new Error(String(error)), {
      module: 'ExplorationExecute',
      runId,
    });

    // Mark run as failed
    try {
      await prisma.explorationRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          statsJson: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      });
      console.log('[ExecuteAsync] Run marked as failed in database');
    } catch (dbError) {
      console.error('[ExecuteAsync] Failed to update run status:', dbError);
    }
  } finally {
    if (browser) {
      console.log('[ExecuteAsync] Closing browser...');
      log.debug('Closing browser', { module: 'ExplorationExecute', runId });
      await browser.close();
      console.log('[ExecuteAsync] Browser closed');
    }
    console.log('[ExecuteAsync] ========== ASYNC EXECUTION FINISHED ==========');
  }
}

/**
 * Simulate test execution for development (when Playwright not available)
 */
async function runSimulatedExecution(runId: string, testCases: TestCase[], environment: string) {
  log.debug('Running simulated execution', { module: 'ExplorationExecute', runId, testCasesCount: testCases.length, environment });

  // Update run status
  await prisma.explorationRun.update({
    where: { id: runId },
    data: {
      status: 'running',
      startedAt: new Date(),
    },
  });

  // Create mock screenshot directory
  const screenshotDir = path.join(process.cwd(), 'public', 'explore', runId);
  const fs = await import('fs/promises');
  await fs.mkdir(screenshotDir, { recursive: true });

  // Generate realistic simulated results
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];

    // More realistic distribution: ~60% pass, ~30% fail, ~10% error
    const rand = Math.random();
    const status = rand < 0.6 ? 'passed' : rand < 0.9 ? 'failed' : 'error';

    let actualResult: string;
    let errorMessage: string | undefined;
    let screenshotUrl: string | undefined;
    let screenshotPath: string | undefined;

    if (status === 'passed') {
      actualResult = testCase.expected;
      screenshotUrl = `/explore/${runId}/test-${i + 1}-success.svg`;
      screenshotPath = path.join(screenshotDir, `test-${i + 1}-success.svg`);
    } else if (status === 'failed') {
      // Generate realistic failure messages
      const failureReasons = [
        `Element not found: Expected to find button with text "${testCase.title.includes('button') ? 'Submit' : 'Login'}"`,
        `Assertion failed: Expected "${testCase.expected}" but found different content on the page`,
        `Timeout: Element did not appear within 30 seconds`,
        `Text mismatch: Expected "${testCase.expected.substring(0, 30)}..." but got different text`,
        `Navigation failed: Expected URL to change but stayed on the same page`
      ];
      actualResult = failureReasons[Math.floor(Math.random() * failureReasons.length)];
      screenshotUrl = `/explore/${runId}/test-${i + 1}-failure.svg`;
      screenshotPath = path.join(screenshotDir, `test-${i + 1}-failure.svg`);
    } else {
      // Error status
      actualResult = 'Test execution error';
      errorMessage = 'Network timeout: Could not connect to the test environment';
      screenshotUrl = `/explore/${runId}/test-${i + 1}-error.svg`;
      screenshotPath = path.join(screenshotDir, `test-${i + 1}-error.svg`);
    }

    // Generate placeholder screenshot with failure reason
    await generatePlaceholderScreenshot(
      screenshotPath,
      status === 'passed' ? 'success' : status === 'failed' ? 'failure' : 'error',
      testCase.title,
      actualResult,
      environment
    );

    // Generate detailed execution log
    const executionLog = testCase.steps.map((step, stepIndex) => ({
      step: stepIndex + 1,
      action: step,
      status: stepIndex < testCase.steps.length - 1 || status === 'passed' ? 'completed' : 'failed',
      duration: Math.floor(Math.random() * 2000) + 500,
      timestamp: new Date(Date.now() - (testCase.steps.length - stepIndex) * 1000).toISOString(),
    }));

    // Check if execution record already exists (from a previous attempt)
    const existingExecution = await prisma.testExecution.findFirst({
      where: {
        runId,
        testCaseTitle: testCase.title,
      },
    });

    if (existingExecution) {
      // Update existing record
      const updated = await prisma.testExecution.update({
        where: { id: existingExecution.id },
        data: {
          status,
          actualResult,
          errorMessage,
          screenshotUrl,
          executionLog: executionLog as any,
          duration: Math.floor(Math.random() * 5000) + 2000,
          finishedAt: new Date(),
          startedAt: new Date(Date.now() - 5000),
        },
      });
      log.debug('Updated existing simulated test execution', {
        module: 'ExplorationExecute',
        executionId: existingExecution.id,
        title: testCase.title,
        status,
        updatedStatus: updated.status
      });
    } else {
      // Create new record
      const execution = await prisma.testExecution.create({
        data: {
          runId,
          testCaseId: testCase.id,
          testCaseTitle: testCase.title,
          testCaseSteps: testCase.steps,
          expectedResult: testCase.expected,
          priority: testCase.priority,
          type: testCase.type,
          status,
          actualResult,
          errorMessage,
          screenshotUrl,
          executionLog: executionLog as any,
          duration: Math.floor(Math.random() * 5000) + 2000,
          finishedAt: new Date(),
          startedAt: new Date(Date.now() - 5000),
        },
      });
      log.debug('Created simulated test execution', {
        module: 'ExplorationExecute',
        executionId: execution.id,
        title: testCase.title,
        status,
        createdStatus: execution.status
      });
    }
  }

  // Calculate actual stats from created executions
  const allExecutions = await prisma.testExecution.findMany({
    where: { runId },
    select: { status: true },
  });

  const passedCount = allExecutions.filter(e => e.status === 'passed').length;
  const failedCount = allExecutions.filter(e => e.status === 'failed').length;
  const errorCount = allExecutions.filter(e => e.status === 'error').length;

  await prisma.explorationRun.update({
    where: { id: runId },
    data: {
      status: 'completed',
      finishedAt: new Date(),
      statsJson: {
        total: testCases.length,
        passed: passedCount,
        failed: failedCount,
        errors: errorCount,
        simulated: true,
      },
    },
  });

  // Verify records were saved by fetching them back
  const savedExecutions = await prisma.testExecution.findMany({
    where: { runId },
    select: { id: true, testCaseTitle: true, status: true }
  });

  log.debug('Simulated execution completed', {
    module: 'ExplorationExecute',
    runId,
    passed: passedCount,
    failed: failedCount,
    totalSaved: savedExecutions.length,
    savedStatuses: savedExecutions.map(e => ({ title: e.testCaseTitle, status: e.status }))
  });

  return NextResponse.json({ ok: true, runId, simulated: true });
}
