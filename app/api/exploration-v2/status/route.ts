import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/iron';
import { prisma } from '@/lib/db/prisma';
import { getQuality } from '@/lib/exploration/objectiveQuality';
import type { Objective } from '@/types/exploration';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json(
        { error: 'runId required' },
        { status: 400 }
      );
    }

    // Get run with bugs and test executions
    const run = await prisma.explorationRun.findFirst({
      where: {
        id: runId,
        userId,
      },
      include: {
        bugs: {
          orderBy: [
            { relevance: 'desc' },
            { createdAt: 'desc' },
          ],
        },
        testExecutions: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Get plan if exists
    let plan = null;
    if (run.planId) {
      const planData = await prisma.explorationPlan.findUnique({
        where: { id: run.planId },
      });

      if (planData) {
        const objectives = planData.objectivesJson as unknown as Objective[];
        const objectivesWithQuality = objectives.map(obj => ({
          ...obj,
          quality: getQuality(obj),
        }));

        plan = {
          id: planData.id,
          scope: planData.scopeJson,
          objectives: objectivesWithQuality,
        };
      }
    }

    // Separate bugs by relevance (high relevance = story-related)
    const storyBugs = run.bugs.filter(b => (b.relevance || 0) >= 0.5);
    const observations = run.bugs.filter(b => (b.relevance || 0) < 0.5);

    return NextResponse.json({
      ok: true,
      run: {
        id: run.id,
        status: run.status,
        mode: run.mode,
        environment: run.environment,
        issueKey: run.issueKey,
        planId: run.planId,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString(),
        stats: run.statsJson,
      },
      plan,
      testExecutions: run.testExecutions.map(exec => ({
        id: exec.id,
        testCaseId: exec.testCaseId,
        testCaseTitle: exec.testCaseTitle,
        status: exec.status,
        priority: exec.priority,
        type: exec.type,
        steps: exec.testCaseSteps,
        expected: exec.expectedResult,
        actualResult: exec.actualResult,
        errorMessage: exec.errorMessage,
        screenshotUrl: exec.screenshotUrl,
        executionLog: exec.executionLog,
        duration: exec.duration,
        startedAt: exec.startedAt?.toISOString(),
        finishedAt: exec.finishedAt?.toISOString(),
        createdAt: exec.createdAt.toISOString(),
      })),
      bugs: storyBugs.map(bug => {
        const steps = bug.stepsJson as string[];

        // Extract evidence fields from steps (for UI_TEXT_CHANGE bugs)
        let expected: string | undefined;
        let observed: string | undefined;
        let url: string | undefined;
        const candidates: Array<{ role: string; name: string; selectorShort: string }> = [];

        for (const step of steps) {
          if (step.startsWith('Expected:')) {
            expected = step.substring('Expected:'.length).trim();
          } else if (step.startsWith('Observed:')) {
            observed = step.substring('Observed:'.length).trim();
          } else if (step.startsWith('URL:')) {
            url = step.substring('URL:'.length).trim();
          } else if (step.startsWith('Candidates found:')) {
            // Parse candidates from "name" (role) format
            const candidatesStr = step.substring('Candidates found:'.length).trim();
            const regex = /"([^"]+)"\s*\(([^)]+)\)/g;
            const matches = Array.from(candidatesStr.matchAll(regex));
            for (const match of matches) {
              candidates.push({
                name: match[1],
                role: match[2],
                selectorShort: '', // Not stored in steps
              });
            }
          }
        }

        return {
          id: bug.id,
          title: bug.title,
          steps: bug.stepsJson,
          severity: bug.severity,
          evidenceUrl: bug.evidenceUrl,
          objectiveId: bug.objectiveId,
          relevance: bug.relevance,
          status: bug.status,
          jiraKey: bug.jiraKey,
          createdAt: bug.createdAt.toISOString(),
          // Evidence fields for UI_TEXT_CHANGE bugs
          expected,
          observed,
          url,
          candidates: candidates.length > 0 ? candidates : undefined,
        };
      }),
      observationsCount: observations.length,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('[Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
