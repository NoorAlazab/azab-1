import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/server/auth/iron';
import { getJiraConnection } from '@/lib/server/db/database';
import { prisma } from '@/lib/server/db/prisma';
import { makeAtlassianApiRequest, decryptToken } from '@/lib/server/oauth/atlassian';
import { getEvidenceUrl } from '@/lib/url-helpers';
import { z } from 'zod';

const PublishSchema = z.object({
  bugIds: z.array(z.string()).optional(),
  runId: z.string().optional(),
});

function mapSeverityToPriority(severity: string): string {
  switch (severity) {
    case 'S0': return 'Highest';
    case 'S1': return 'High';
    case 'S2': return 'Medium';
    case 'S3': return 'Low';
    default: return 'Medium';
  }
}

function formatStepsAsADF(steps: any): any {
  const stepsArray = Array.isArray(steps) ? steps : [];

  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'orderedList',
        content: stepsArray.map((step: string) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: step,
                },
              ],
            },
          ],
        })),
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const validated = PublishSchema.parse(body);

    // Get Jira connection
    const jiraConnection = await getJiraConnection(userId);
    if (!jiraConnection || !jiraConnection.activeCloudId) {
      return NextResponse.json(
        { error: 'Jira connection required' },
        { status: 400 }
      );
    }

    const accessToken = decryptToken(jiraConnection.accessTokenEncrypted || '');

    // Get bugs to publish
    let bugsToPublish;

    if (validated.bugIds && validated.bugIds.length > 0) {
      // Publish specific bugs
      bugsToPublish = await prisma.bugFinding.findMany({
        where: {
          id: { in: validated.bugIds },
          status: { in: ['new', 'edited'] },
        },
        include: {
          run: true,
        },
      });
    } else if (validated.runId) {
      // Publish all new/edited bugs in run
      bugsToPublish = await prisma.bugFinding.findMany({
        where: {
          runId: validated.runId,
          status: { in: ['new', 'edited'] },
        },
        include: {
          run: true,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'bugIds or runId required' },
        { status: 400 }
      );
    }

    // Verify all bugs belong to user
    for (const bug of bugsToPublish) {
      if (bug.run.userId !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }
    }

    const results = [];

    for (const bug of bugsToPublish) {
      try {
        // Get parent story to determine project
        const storyUrl = `https://api.atlassian.com/ex/jira/${jiraConnection.activeCloudId}/rest/api/3/issue/${bug.issueKey}?fields=project`;
        const storyResponse = await makeAtlassianApiRequest(accessToken, storyUrl);

        if (!storyResponse.ok) {
          throw new Error(`Failed to fetch story: ${storyResponse.status}`);
        }

        const story = await storyResponse.json();
        const projectId = story.fields.project.id;

        // Load plan if objective-based
        let plan = null;
        if (bug.run.planId) {
          plan = await prisma.explorationPlan.findUnique({
            where: { id: bug.run.planId },
          });
        }

        // Extract expected/observed/candidates from stepsJson
        let stepsArray: string[] = [];
        let expectedText = '';
        let observedText = '';
        let testUrl = bug.run.environment;
        let objectiveInfo = '';
        const candidates: Array<{ name: string; role: string }> = [];

        if (typeof bug.stepsJson === 'object' && bug.stepsJson !== null && !Array.isArray(bug.stepsJson)) {
          const stepsData = bug.stepsJson as any;
          stepsArray = stepsData.steps || [];
          expectedText = stepsData.expected || '';
          observedText = stepsData.observed || '';
          testUrl = stepsData.url || bug.run.environment;

          if (stepsData.objectiveType && stepsData.target) {
            const target = stepsData.target;
            const targetParts: string[] = [];
            if (target.roles?.length > 0) targetParts.push(`Roles: ${target.roles.join(', ')}`);
            if (target.texts?.length > 0) targetParts.push(`Texts: ${target.texts.join(', ')}`);
            if (target.paths?.length > 0) targetParts.push(`Paths: ${target.paths.join(', ')}`);
            objectiveInfo = `Type: ${stepsData.objectiveType}. ${targetParts.join('; ')}`;
          }
        } else {
          stepsArray = Array.isArray(bug.stepsJson)
            ? (bug.stepsJson as any[]).filter((s): s is string => typeof s === 'string')
            : [];

          // Extract from steps array (UI_TEXT_CHANGE format)
          for (const step of stepsArray) {
            if (step.startsWith('Expected:')) {
              expectedText = step.substring('Expected:'.length).trim();
            } else if (step.startsWith('Observed:')) {
              observedText = step.substring('Observed:'.length).trim();
            } else if (step.startsWith('URL:')) {
              testUrl = step.substring('URL:'.length).trim();
            } else if (step.startsWith('Candidates found:')) {
              const candidatesStr = step.substring('Candidates found:'.length).trim();
              const regex = /"([^"]+)"\s*\(([^)]+)\)/g;
              const matches = Array.from(candidatesStr.matchAll(regex));
              for (const match of matches) {
                candidates.push({
                  name: match[1],
                  role: match[2],
                });
              }
            }
          }
        }

        // Format description with Expected vs Observed
        const descriptionContent = [
          ...(objectiveInfo ? [
            {
              type: 'heading',
              attrs: { level: 3 },
              content: [{ type: 'text', text: 'Objective Details' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: objectiveInfo }],
            },
          ] : []),
          ...(expectedText || observedText ? [
            {
              type: 'heading',
              attrs: { level: 3 },
              content: [{ type: 'text', text: 'Expected vs Observed' }],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: '✅ Expected: ', marks: [{ type: 'strong' }] },
                { type: 'text', text: expectedText || 'Not specified' },
              ],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: '❌ Observed: ', marks: [{ type: 'strong' }] },
                { type: 'text', text: observedText || 'Test failed' },
              ],
            },
          ] : []),
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Reproduction Steps' }],
          },
          ...(stepsArray.length > 0 ? formatStepsAsADF(stepsArray).content : [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'No steps recorded' }],
            },
          ]),
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Environment & Context' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Environment: ', marks: [{ type: 'strong' }] },
              { type: 'text', text: bug.run.environment },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'URL: ', marks: [{ type: 'strong' }] },
              { type: 'text', text: testUrl },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Severity: ', marks: [{ type: 'strong' }] },
              { type: 'text', text: bug.severity },
            ],
          },
          ...(bug.relevance !== null ? [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Relevance Score: ', marks: [{ type: 'strong' }] },
                { type: 'text', text: `${(bug.relevance * 100).toFixed(0)}%` },
              ],
            },
          ] : []),
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Run Timestamp: ', marks: [{ type: 'strong' }] },
              { type: 'text', text: bug.run.startedAt.toISOString() },
            ],
          },
          ...(candidates.length > 0 ? [
            {
              type: 'heading',
              attrs: { level: 3 },
              content: [{ type: 'text', text: 'CTA Candidates Found' }],
            },
            {
              type: 'paragraph',
              content: [{
                type: 'text',
                text: `The following buttons/links were found during verification (top ${Math.min(candidates.length, 5)}):`,
              }],
            },
            {
              type: 'table',
              content: [
                {
                  type: 'tableRow',
                  content: [
                    {
                      type: 'tableHeader',
                      content: [{
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Text', marks: [{ type: 'strong' }] }],
                      }],
                    },
                    {
                      type: 'tableHeader',
                      content: [{
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Role', marks: [{ type: 'strong' }] }],
                      }],
                    },
                  ],
                },
                ...candidates.slice(0, 5).map(c => ({
                  type: 'tableRow',
                  content: [
                    {
                      type: 'tableCell',
                      content: [{
                        type: 'paragraph',
                        content: [{ type: 'text', text: c.name }],
                      }],
                    },
                    {
                      type: 'tableCell',
                      content: [{
                        type: 'paragraph',
                        content: [{ type: 'text', text: c.role }],
                      }],
                    },
                  ],
                })),
              ],
            },
          ] : []),
          ...(bug.evidenceUrl ? [
            {
              type: 'heading',
              attrs: { level: 3 },
              content: [{ type: 'text', text: 'Evidence' }],
            },
            {
              type: 'paragraph',
              content: [{
                type: 'text',
                text: `Screenshot: ${getEvidenceUrl(bug.evidenceUrl)}`,
                marks: [{ type: 'link', attrs: { href: getEvidenceUrl(bug.evidenceUrl) } }],
              }],
            },
          ] : []),
        ];

        const descriptionADF = {
          type: 'doc',
          version: 1,
          content: descriptionContent,
        };

        // Create bug issue
        const createIssueUrl = `https://api.atlassian.com/ex/jira/${jiraConnection.activeCloudId}/rest/api/3/issue`;
        const createResponse = await makeAtlassianApiRequest(accessToken, createIssueUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              project: { id: projectId },
              issuetype: { name: 'Bug' },
              summary: bug.title,
              description: descriptionADF,
              labels: ['omniforge', 'exploration', bug.run.mode],
              priority: { name: mapSeverityToPriority(bug.severity) },
            },
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          throw new Error(`Failed to create bug: ${JSON.stringify(errorData)}`);
        }

        const newBug = await createResponse.json();
        const bugKey = newBug.key;

        // Create issue link (Relates to story)
        const linkUrl = `https://api.atlassian.com/ex/jira/${jiraConnection.activeCloudId}/rest/api/3/issueLink`;
        await makeAtlassianApiRequest(accessToken, linkUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: { name: 'Relates' },
            inwardIssue: { key: bugKey },
            outwardIssue: { key: bug.issueKey },
          }),
        });

        // Update bug status
        await prisma.bugFinding.update({
          where: { id: bug.id },
          data: {
            status: 'published',
            jiraKey: bugKey,
          },
        });

        results.push({
          bugId: bug.id,
          success: true,
          jiraKey: bugKey,
        });

      } catch (error) {
        console.error(`[Publish] Failed to publish bug ${bug.id}:`, error);
        results.push({
          bugId: bug.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      ok: true,
      results,
    });

  } catch (error) {
    console.error('[Publish] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to publish bugs' },
      { status: 500 }
    );
  }
}
