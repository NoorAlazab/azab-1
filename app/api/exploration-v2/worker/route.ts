import { NextRequest, NextResponse } from 'next/server';
import { runObjectiveBasedExploration, type ObjectiveRunnerInput } from '@/lib/server/exploration/objectiveRunner';
import { runExploration, type RunnerInput } from '@/lib/server/exploration/runner';
import { prisma } from '@/lib/server/db/prisma';
import { makeAtlassianApiRequest, decryptToken } from '@/lib/server/oauth/atlassian';
import { log } from '@/lib/shared/utils/logger';

export const maxDuration = 300; // 5 minutes max

/**
 * Extract text from Atlassian Document Format (ADF)
 */
function extractTextFromADF(adf: any): string {
  if (!adf || !adf.content) return '';

  function extractFromContent(content: any[]): string {
    return content.map(node => {
      if (node.type === 'text') {
        return node.text || '';
      } else if (node.content) {
        return extractFromContent(node.content);
      }
      return '';
    }).join(' ');
  }

  return extractFromContent(adf.content).trim();
}

/**
 * Extract test scenarios from acceptance criteria
 */
function extractTestScenarios(acceptanceCriteria: string): string[] {
  if (!acceptanceCriteria || acceptanceCriteria.trim() === '') {
    return [];
  }

  const lines = acceptanceCriteria.split('\n');
  const scenarios: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const cleaned = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
      if (cleaned.length > 10) {
        scenarios.push(cleaned);
      }
    } else if (trimmed.length > 20 && !trimmed.endsWith(':')) {
      scenarios.push(trimmed);
    }
  }

  return scenarios;
}

/**
 * Fetch story content from Jira
 */
async function fetchStoryContext(storyKey: string, userId: string): Promise<RunnerInput['storyContext'] | undefined> {
  log.debug('fetchStoryContext called', { module: 'ExplorationV2Worker', storyKey, userId });

  try {
    // Get Jira connection
    const jiraConnection = await prisma.jiraConnection.findFirst({
      where: { userId },
    });

    log.debug('Jira connection status', {
      module: 'ExplorationV2Worker',
      found: !!jiraConnection,
      hasCloudId: !!jiraConnection?.activeCloudId,
    });

    if (!jiraConnection || !jiraConnection.activeCloudId) {
      log.warn('No Jira connection found, running without story context', { module: 'ExplorationV2Worker' });
      return undefined;
    }

    // Fetch issue from Jira
    const accessToken = decryptToken(jiraConnection.accessTokenEncrypted || "");
    const issueUrl = `https://api.atlassian.com/ex/jira/${jiraConnection.activeCloudId}/rest/api/3/issue/${storyKey}`;

    log.debug('Fetching from Jira', { module: 'ExplorationV2Worker', issueUrl });

    const response = await makeAtlassianApiRequest(accessToken, issueUrl, {
      method: "GET",
    });

    log.debug('Jira API response', { module: 'ExplorationV2Worker', status: response.status });

    if (!response.ok) {
      log.warn('Failed to fetch Jira story', { module: 'ExplorationV2Worker', status: response.status });
      return undefined;
    }

    const issue = await response.json();
    log.debug('Got issue from Jira', {
      module: 'ExplorationV2Worker',
      key: issue.key,
      hasSummary: !!issue.fields?.summary,
      hasDescription: !!issue.fields?.description,
    });

    // Extract description (handle ADF format)
    let description = '';
    if (issue.fields?.description) {
      if (typeof issue.fields.description === 'string') {
        description = issue.fields.description;
      } else if (issue.fields.description.content) {
        description = extractTextFromADF(issue.fields.description);
      }
    }

    // Extract acceptance criteria from common custom fields
    let acceptanceCriteria = '';
    const acFields = ['customfield_10000', 'customfield_10100', 'customfield_10200'];
    for (const fieldId of acFields) {
      if (issue.fields?.[fieldId]) {
        const value = issue.fields[fieldId];
        if (typeof value === 'string') {
          acceptanceCriteria = value;
          break;
        } else if (value?.content) {
          acceptanceCriteria = extractTextFromADF(value);
          break;
        }
      }
    }

    // Extract test scenarios
    const testScenarios = extractTestScenarios(acceptanceCriteria);

    const result = {
      summary: issue.fields?.summary || '',
      description,
      acceptanceCriteria,
      testScenarios,
    };

    log.debug('Returning story context', {
      module: 'ExplorationV2Worker',
      hasSummary: !!result.summary,
      hasDescription: !!result.description,
      hasAcceptanceCriteria: !!result.acceptanceCriteria,
      testScenariosCount: result.testScenarios.length,
    });

    return result;
  } catch (error) {
    log.error('Error fetching story context', error instanceof Error ? error : new Error(String(error)), { module: 'ExplorationV2Worker' });
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    log.debug('POST request received', { module: 'ExplorationV2Worker' });
    const body: any = await request.json();
    log.debug('Request body received', {
      module: 'ExplorationV2Worker',
      runId: body.runId,
      storyKey: body.storyKey,
      planId: body.planId,
      mode: body.mode,
    });

    // Fetch the exploration run to get userId and planId
    const run = await prisma.explorationRun.findUnique({
      where: { id: body.runId },
      select: { userId: true, planId: true },
    });

    log.debug('Found exploration run', { module: 'ExplorationV2Worker', runId: body.runId, userId: run?.userId, planId: run?.planId });

    if (!run) {
      throw new Error('Exploration run not found');
    }

    // Check if we have a plan - use objective runner if so
    const planId = body.planId || run.planId;

    if (planId) {
      log.debug('Using objective-based exploration', { module: 'ExplorationV2Worker', planId });

      const objectiveInput: ObjectiveRunnerInput = {
        runId: body.runId,
        environment: body.environment,
        planId,
        auth: body.auth,
      };

      await runObjectiveBasedExploration(objectiveInput);
    } else {
      log.debug('No plan found, using legacy exploration', { module: 'ExplorationV2Worker' });

      // Fallback to legacy runner with story context
      const storyContext = await fetchStoryContext(body.storyKey, run.userId);
      log.debug('Story context fetched', {
        module: 'ExplorationV2Worker',
        hasContext: !!storyContext,
        testScenariosCount: storyContext?.testScenarios.length || 0,
      });

      const inputWithContext: RunnerInput = {
        ...body,
        storyContext,
      };

      await runExploration(inputWithContext);
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    log.error('Worker failed', error instanceof Error ? error : new Error(String(error)), { module: 'ExplorationV2Worker' });
    return NextResponse.json(
      { error: 'Worker failed' },
      { status: 500 }
    );
  }
}
