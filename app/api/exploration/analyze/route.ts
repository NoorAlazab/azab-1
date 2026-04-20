import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/server/auth/iron';
import { getJiraConnection } from '@/lib/server/db/database';
import { prisma } from '@/lib/server/db/prisma';
import { synthesizeCases } from '@/lib/tests/caseSynth';
import { buildPlan } from '@/lib/server/exploration/planFromStory';
import { getQuality, meetsQualityThreshold } from '@/lib/server/exploration/objectiveQuality';
import { makeAtlassianApiRequest, decryptToken } from '@/lib/server/oauth/atlassian';
import { identifyPagesFromStory } from '@/lib/server/exploration/pageIdentifier';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';

interface AnalyzeRequest {
  storyKey: string;
  environment: string;
  story?: {
    summary: string;
    descriptionText?: string;
    acceptanceCriteriaText?: string;
  };
}

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

export async function POST(request: NextRequest) {
  try {
    log.debug('Request received', { module: 'ExplorationAnalyze' });

    // Require authentication
    const userId = await requireUserId();
    log.debug('User authenticated', { module: 'ExplorationAnalyze', userId });

    // Parse request
    const body: AnalyzeRequest = await request.json();
    log.debug('Story key and environment', { module: 'ExplorationAnalyze', storyKey: body.storyKey, environment: body.environment });

    // Get Jira connection to resolve cloudId
    const jiraConnection = await getJiraConnection(userId);

    if (!jiraConnection || !jiraConnection.activeCloudId) {
      return NextResponse.json(
        { error: 'Jira connection required' },
        { status: 400 }
      );
    }

    const cloudId = jiraConnection.activeCloudId;
    log.debug('Cloud ID resolved', { module: 'ExplorationAnalyze', cloudId });

    // Fetch story from Jira if not provided
    let storySummary = body.story?.summary || '';
    let storyDescription = body.story?.descriptionText || '';
    let acceptanceCriteria = body.story?.acceptanceCriteriaText || '';

    if (!storySummary) {
      log.debug('No story provided, fetching from Jira', { module: 'ExplorationAnalyze' });
      try {
        const accessToken = decryptToken(jiraConnection.accessTokenEncrypted || '');
        const issueUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${body.storyKey}`;

        const response = await makeAtlassianApiRequest(accessToken, issueUrl, {
          method: 'GET',
        });

        if (response.ok) {
          const issue = await response.json();
          storySummary = issue.fields?.summary || body.storyKey;

          // Extract description
          if (issue.fields?.description) {
            if (typeof issue.fields.description === 'string') {
              storyDescription = issue.fields.description;
            } else if (issue.fields.description.content) {
              storyDescription = extractTextFromADF(issue.fields.description);
            }
          }

          // Try to extract acceptance criteria from common custom fields
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

          log.debug('Fetched story from Jira', {
            module: 'ExplorationAnalyze',
            summary: storySummary,
            hasDescription: !!storyDescription,
            hasAC: !!acceptanceCriteria,
          });
        } else {
          log.warn('Failed to fetch from Jira, using story key as summary', { module: 'ExplorationAnalyze' });
          storySummary = body.storyKey;
        }
      } catch (error) {
        log.error('Error fetching from Jira', error instanceof Error ? error : new Error(String(error)), { module: 'ExplorationAnalyze' });
        storySummary = body.storyKey;
      }
    }

    log.debug('Story summary prepared', { module: 'ExplorationAnalyze', storySummary });

    // Synthesize test cases
    log.debug('Synthesizing test cases', { module: 'ExplorationAnalyze' });
    const synthesizedCases = await synthesizeCases({
      summary: storySummary,
      description: storyDescription,
      acceptanceCriteria,
    });

    log.debug('Synthesized test cases', { module: 'ExplorationAnalyze', count: synthesizedCases.length });

    // Upsert TestSuite
    const suite = await prisma.testSuite.upsert({
      where: {
        uniq_user_issue: {
          userId,
          issueKey: body.storyKey,
        },
      },
      update: {
        environment: body.environment,
        dirty: true,
        cloudId,
        updatedAt: new Date(),
      },
      create: {
        userId,
        issueKey: body.storyKey,
        cloudId,
        environment: body.environment,
        status: 'draft',
        dirty: true,
      },
    });

    log.debug('Test suite created/updated', { module: 'ExplorationAnalyze', suiteId: suite.id });

    // Delete existing cases and create new ones
    await prisma.testCase.deleteMany({
      where: { suiteId: suite.id },
    });

    const casesData = synthesizedCases.map((c, index) => ({
      suiteId: suite.id,
      title: c.title,
      stepsJson: c.steps,
      expected: c.expected,
      priority: c.priority || 'P2',
      order: index,
    }));

    await prisma.testCase.createMany({
      data: casesData,
    });

    log.debug('Created test cases', { module: 'ExplorationAnalyze', count: casesData.length });

    // Build exploration plan
    log.debug('Building exploration plan', { module: 'ExplorationAnalyze' });
    const plan = buildPlan({
      summary: storySummary,
      description: storyDescription,
      acceptanceCriteria,
      envUrl: body.environment,
      testCases: synthesizedCases,
    });

    log.debug('Plan generated', { module: 'ExplorationAnalyze', objectivesCount: plan.objectives.length });

    // Upsert exploration plan
    const existingPlan = await prisma.explorationPlan.findFirst({
      where: {
        userId,
        issueKey: body.storyKey,
      },
    });

    let savedPlan;
    if (existingPlan) {
      savedPlan = await prisma.explorationPlan.update({
        where: { id: existingPlan.id },
        data: {
          cloudId,
          storySummary,
          storyDescription: storyDescription || null,
          objectivesJson: plan.objectives as any,
          scopeJson: plan.scope as any,
        },
      });
    } else {
      savedPlan = await prisma.explorationPlan.create({
        data: {
          userId,
          issueKey: body.storyKey,
          cloudId,
          storySummary,
          storyDescription: storyDescription || null,
          objectivesJson: plan.objectives as any,
          scopeJson: plan.scope as any,
        },
      });
    }

    log.debug('Exploration plan saved', { module: 'ExplorationAnalyze', planId: savedPlan.id });

    // Get intent information
    const primaryIntent = plan.intent.primary;
    const intentTerms = plan.intent.terms;

    log.debug('Intent classification', { module: 'ExplorationAnalyze', primaryIntent, intentTerms, rawObjectivesCount: plan.objectives.length });

    // Score each objective and add quality metadata
    let objectivesWithQuality = plan.objectives.map(obj => ({
      ...obj,
      quality: getQuality(obj),
    }));

    log.debug('Objectives with quality scores', {
      module: 'ExplorationAnalyze',
      objectives: objectivesWithQuality.map(obj => ({
        title: obj.title,
        type: obj.type,
        quality: obj.quality,
        target: obj.target,
      }))
    });

    // Filter objectives by quality threshold based on intent
    const beforeQualityFilter = objectivesWithQuality.length;
    objectivesWithQuality = objectivesWithQuality.filter(obj =>
      meetsQualityThreshold(obj, primaryIntent)
    );
    log.debug('After quality filter', { module: 'ExplorationAnalyze', before: beforeQualityFilter, after: objectivesWithQuality.length });

    // For UI_TEXT_CHANGE, filter to only keep UI-related objectives
    if (primaryIntent === 'UI_TEXT_CHANGE') {
      const allowedTypes = ['UI_TEXT_MATCH', 'ELEMENT_PRESENCE', 'A11Y_RULE'];
      const beforeTypeFilter = objectivesWithQuality.length;
      objectivesWithQuality = objectivesWithQuality.filter(obj =>
        allowedTypes.includes(obj.type)
      );
      log.debug('After type filter for UI_TEXT_CHANGE', { module: 'ExplorationAnalyze', before: beforeTypeFilter, after: objectivesWithQuality.length });
    }

    // Check if any objective meets quality threshold
    const hasHighQualityObjective = objectivesWithQuality.some(
      obj => obj.quality.score >= 0.6
    );

    // Determine if refinement is needed
    let needsRefinement = !hasHighQualityObjective;
    let refinementHint: string | undefined;

    if (primaryIntent === 'UI_TEXT_CHANGE') {
      if (!intentTerms.to) {
        needsRefinement = true;
        refinementHint = 'Story is ambiguous; specify the new label (e.g., "Login")';
      } else if (objectivesWithQuality.length === 0) {
        needsRefinement = true;
        refinementHint = 'Could not generate concrete objectives. Add more specific details about the UI element.';
      } else if (!hasHighQualityObjective) {
        refinementHint = 'Objectives generated but may be too vague. Consider adding more specific acceptance criteria.';
      }
    } else {
      refinementHint = needsRefinement
        ? 'Objectives are too vague. Try providing more specific acceptance criteria or use the Refine button.'
        : undefined;
    }

    log.debug('Refinement analysis', { module: 'ExplorationAnalyze', needsRefinement, filteredObjectivesCount: objectivesWithQuality.length });

    // Fetch the created test cases to return
    const createdTestCases = await prisma.testCase.findMany({
      where: { suiteId: suite.id },
      orderBy: { order: 'asc' },
    });

    // Transform test cases for client
    const testCasesForClient = createdTestCases.map(tc => ({
      id: tc.id,
      title: tc.title,
      steps: tc.stepsJson as string[],
      expected: tc.expected,
      priority: tc.priority || 'P2',
      type: tc.type || 'functional',
    }));

    // Identify required pages for selector recording
    const testScenarios = synthesizedCases.map(c => c.title);
    const requiredPages = identifyPagesFromStory(
      storySummary,
      storyDescription,
      acceptanceCriteria,
      testScenarios
    );

    log.debug('Identified required pages', { module: 'ExplorationAnalyze', requiredPages });

    return NextResponse.json({
      ok: true,
      suite: {
        id: suite.id,
        issueKey: suite.issueKey,
      },
      testCases: testCasesForClient,
      autoDraftedCases: synthesizedCases.length,
      plan: {
        id: savedPlan.id,
        scope: plan.scope,
        objectives: objectivesWithQuality,
      },
      intent: primaryIntent,
      terms: intentTerms,
      needsRefinement,
      refinementHint,
      requiredPages,
    });
  } catch (error) {
    log.error('Failed to analyze story', error instanceof Error ? error : new Error(String(error)), { module: 'ExplorationAnalyze' });
    return NextResponse.json(
      {
        error: 'Failed to analyze story',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
