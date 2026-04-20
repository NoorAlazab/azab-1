import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/server/auth/iron';
import { getJiraConnection } from '@/lib/server/db/database';
import { prisma } from '@/lib/server/db/prisma';
import { getApiUrl } from '@/lib/url-helpers';
import { z } from 'zod';
import { log } from '@/lib/utils/logger';

const StartExplorationSchema = z.object({
  storyKey: z.string().min(1),
  environment: z.string().url(),
  planId: z.string().optional(),
  story: z.object({
    summary: z.string(),
    descriptionText: z.string().optional(),
    acceptanceCriteriaText: z.string().optional(),
  }).optional(),
  auth: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
  mode: z.enum(['smoke', 'auth', 'deep', 'a11y']),
  limits: z.object({
    maxPages: z.number().optional(),
    maxMinutes: z.number().optional(),
    userAgent: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    log.debug('Request received', { module: 'ExplorationV2Start' });

    // Require authentication
    const userId = await requireUserId();
    log.debug('User authenticated', { module: 'ExplorationV2Start', userId });

    // Parse and validate request body
    const body = await request.json();
    log.debug('Request body received', { module: 'ExplorationV2Start', body: JSON.stringify(body, null, 2) });

    const validated = StartExplorationSchema.parse(body);
    log.debug('Validation passed', { module: 'ExplorationV2Start' });

    // Get Jira connection to resolve cloudId
    const jiraConnection = await getJiraConnection(userId);
    log.debug('Jira connection status', { module: 'ExplorationV2Start', found: !!jiraConnection });

    if (!jiraConnection || !jiraConnection.activeCloudId) {
      log.warn('No Jira connection or activeCloudId', { module: 'ExplorationV2Start' });
      return NextResponse.json(
        { error: 'Jira connection required' },
        { status: 400 }
      );
    }

    const cloudId = jiraConnection.activeCloudId;
    log.debug('CloudId resolved', { module: 'ExplorationV2Start', cloudId });

    // Get or create plan
    let planId = validated.planId;

    if (!planId) {
      log.debug('No planId provided, calling analyze', { module: 'ExplorationV2Start' });

      // Call analyze internally
      const analyzeUrl = getApiUrl('/api/exploration/analyze');
      const analyzeResponse = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('Cookie') || '',
        },
        body: JSON.stringify({
          storyKey: validated.storyKey,
          environment: validated.environment,
          story: validated.story,
        }),
      });

      if (!analyzeResponse.ok) {
        const error = await analyzeResponse.json();
        throw new Error(`Analyze failed: ${error.error || 'Unknown error'}`);
      }

      const analyzeData = await analyzeResponse.json();
      planId = analyzeData.plan.id;
      log.debug('Created plan', { module: 'ExplorationV2Start', planId });
    } else {
      log.debug('Using provided planId', { module: 'ExplorationV2Start', planId });
    }

    // Create exploration run
    log.debug('Creating exploration run', { module: 'ExplorationV2Start' });
    const run = await prisma.explorationRun.create({
      data: {
        userId,
        issueKey: validated.storyKey,
        cloudId,
        planId,
        environment: validated.environment,
        mode: validated.mode,
        authUsed: Boolean(validated.auth?.username),
        status: 'running',
      },
    });
    log.debug('Exploration run created', { module: 'ExplorationV2Start', runId: run.id });

    // Kick off worker asynchronously (fire and forget)
    // In production, use a proper queue like BullMQ or AWS SQS
    const workerUrl = getApiUrl('/api/exploration-v2/worker');
    log.debug('Triggering worker', { module: 'ExplorationV2Start', workerUrl });

    const workerPayload = {
      runId: run.id,
      environment: validated.environment,
      storyKey: validated.storyKey,
      planId,
      mode: validated.mode,
      auth: validated.auth,
      limits: validated.limits,
    };

    log.debug('Worker payload', { module: 'ExplorationV2Start', payload: workerPayload });

    fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workerPayload),
    })
      .then(res => {
        log.debug('Worker triggered successfully', { module: 'ExplorationV2Start', status: res.status });
        return res.text();
      })
      .then(text => {
        log.debug('Worker response received', { module: 'ExplorationV2Start', response: text });
      })
      .catch(err => {
        log.error('Failed to trigger worker', err instanceof Error ? err : new Error(String(err)), { module: 'ExplorationV2Start' });
      });

    return NextResponse.json({
      ok: true,
      runId: run.id,
      planId,
    });

  } catch (error) {
    log.error('Failed to start exploration', error instanceof Error ? error : new Error(String(error)), { module: 'ExplorationV2Start' });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to start exploration' },
      { status: 500 }
    );
  }
}
