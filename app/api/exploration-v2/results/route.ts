import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/server/auth/iron';
import { prisma } from '@/lib/server/db/prisma';
import { log } from '@/lib/shared/utils/logger';

/**
 * Get test execution results for a run
 * Fixed: Using direct queries instead of transactions to avoid SQLite snapshot issues
 */
export async function GET(request: NextRequest) {
  console.log('========================================');
  console.log('[ResultsAPI] GET REQUEST RECEIVED');
  console.log('[ResultsAPI] Timestamp:', new Date().toISOString());
  console.log('[ResultsAPI] URL:', request.url);
  console.log('========================================');

  try {
    // Require authentication
    const userId = await requireUserId();
    console.log('[ResultsAPI] User authenticated, userId:', userId);

    // Get runId from query params
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json(
        { error: 'runId parameter required' },
        { status: 400 }
      );
    }

    console.log('[ResultsAPI] About to query database for runId:', runId);
    console.log('[ResultsAPI] Query timestamp:', new Date().toISOString());

    // Use RAW SQL queries to completely bypass Prisma's query cache
    // This ensures we always read the absolute latest data from SQLite
    console.log('[ResultsAPI] Using raw SQL to bypass Prisma cache...');

    // Query exploration run with raw SQL
    const runResults = await prisma.$queryRaw<any[]>`
      SELECT * FROM exploration_runs
      WHERE id = ${runId} AND userId = ${userId}
      LIMIT 1
    `;

    const rawRun = runResults[0] || null;

    if (!rawRun) {
      console.log('[ResultsAPI] Run not found or access denied');
      return NextResponse.json(
        { error: 'Run not found or access denied' },
        { status: 404 }
      );
    }

    console.log('[ResultsAPI] Run found via raw SQL, querying test executions...');

    // Query test executions with raw SQL - this bypasses ALL Prisma caching
    const rawExecutions = await prisma.$queryRaw<any[]>`
      SELECT * FROM test_executions
      WHERE runId = ${rawRun.id}
      ORDER BY createdAt ASC
    `;

    console.log('[ResultsAPI] Found', rawExecutions.length, 'test executions via raw SQL');

    // Transform raw SQL results to match expected format
    // Raw SQL returns strings for dates and JSON fields
    const run = {
      ...rawRun,
      startedAt: rawRun.startedAt ? new Date(rawRun.startedAt) : null,
      finishedAt: rawRun.finishedAt ? new Date(rawRun.finishedAt) : null,
      statsJson: typeof rawRun.statsJson === 'string' && rawRun.statsJson
        ? JSON.parse(rawRun.statsJson)
        : rawRun.statsJson,
    };

    const testExecutions = rawExecutions.map(exec => ({
      ...exec,
      createdAt: exec.createdAt ? new Date(exec.createdAt) : null,
      updatedAt: exec.updatedAt ? new Date(exec.updatedAt) : null,
      startedAt: exec.startedAt ? new Date(exec.startedAt) : null,
      finishedAt: exec.finishedAt ? new Date(exec.finishedAt) : null,
      testCaseSteps: typeof exec.testCaseSteps === 'string' && exec.testCaseSteps
        ? JSON.parse(exec.testCaseSteps)
        : exec.testCaseSteps,
      executionLog: typeof exec.executionLog === 'string' && exec.executionLog
        ? JSON.parse(exec.executionLog)
        : exec.executionLog,
    }));

    console.log('[ResultsAPI] Found run:', {
      id: run.id,
      status: run.status,
      testExecutionsCount: testExecutions.length
    });

    // Log raw database records for debugging
    console.log('[ResultsAPI] Raw test executions from database:');
    testExecutions.forEach((exec, i) => {
      console.log(`[ResultsAPI]   #${i + 1}:`, {
        id: exec.id,
        title: exec.testCaseTitle,
        status: exec.status,
        hasError: !!exec.errorMessage,
        errorPreview: exec.errorMessage?.substring(0, 80)
      });
    });

    log.debug('Raw test executions from database', {
      module: 'ExplorationResults',
      runId,
      count: testExecutions.length,
      statuses: testExecutions.map(e => ({ id: e.id, title: e.testCaseTitle, status: e.status }))
    });

    // Transform test executions for client
    const results = testExecutions.map(execution => ({
      id: execution.id,
      testCaseId: execution.testCaseId,
      title: execution.testCaseTitle,
      steps: execution.testCaseSteps,
      expected: execution.expectedResult,
      priority: execution.priority,
      type: execution.type,
      status: execution.status,
      actualResult: execution.actualResult,
      errorMessage: execution.errorMessage,
      screenshotUrl: execution.screenshotUrl,
      executionLog: execution.executionLog,
      duration: execution.duration,
      startedAt: execution.startedAt?.toISOString(),
      finishedAt: execution.finishedAt?.toISOString(),
    }));

    console.log('[ResultsAPI] Transformed results sample:', results.slice(0, 2).map(r => ({
      title: r.title,
      status: r.status,
      errorMessage: r.errorMessage?.substring(0, 50)
    })));

    console.log('[ResultsAPI] ALL STATUSES:', results.map((r, i) => `${i+1}:${r.status}`).join(', '));

    // Calculate summary stats
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      errors: results.filter(r => r.status === 'error').length,
      pending: results.filter(r => r.status === 'pending').length,
      running: results.filter(r => r.status === 'running').length,
    };

    console.log('[ResultsAPI] Summary stats calculated:', summary);
    console.log('[ResultsAPI] About to return to client');

    log.debug('Returning results to client', {
      module: 'ExplorationResults',
      runId,
      summary
    });

    const response = NextResponse.json({
      ok: true,
      run: {
        id: run.id,
        issueKey: run.issueKey,
        environment: run.environment,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString(),
        stats: run.statsJson,
      },
      results,
      summary,
    });

    // Prevent caching to ensure fresh data on every poll
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error) {
    console.error('[ResultsAPI] CRITICAL ERROR occurred:');
    console.error('[ResultsAPI] Error type:', error instanceof Error ? 'Error object' : typeof error);
    console.error('[ResultsAPI] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[ResultsAPI] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    log.error('Results request failed', error instanceof Error ? error : new Error(String(error)), {
      module: 'ExplorationResults',
    });
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}
