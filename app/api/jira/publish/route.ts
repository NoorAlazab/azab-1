export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db/prisma";
import { requireUserId } from "@/lib/server/auth/iron";
import { getFreshAccessTokenForUser } from "@/lib/server/jira/tokenService";
import { paragraph, codeBlock, doc, heading, orderedList, paragraphWithStrong } from "@/lib/server/jira/adf";
import { assertValidCsrf } from "@/lib/server/security/csrf";
import { safeStringify, toDisplayDetail } from "@/lib/utils/safeStringify";
import { Limiters, enforceRateLimit } from "@/lib/server/security/rateLimit";

export async function POST(req: Request) {
  try { assertValidCsrf(); } catch(e:any){ return new Response(JSON.stringify({error:"Invalid CSRF token"}), {status:403}); }

  try {
    const userId = await requireUserId();
    // Cap Jira write throughput per user — Atlassian's own quotas are
    // generous but their account-level abuse detection is not, and a
    // bug in our retry loop should not be allowed to burn through them.
    const blocked = await enforceRateLimit(req, Limiters.jiraWrite(), userId);
    if (blocked) return blocked;
    const { suiteId, mode } = await req.json().catch(()=> ({}));
    if (!suiteId) return NextResponse.json({ ok:false, error:"MISSING_FIELDS" }, { status:400 });

    const suite = await prisma.testSuite.findFirst({ where: { id: suiteId, userId } });
    const count = await prisma.testCase.count({ where: { suiteId } });
    if (!suite || count === 0) {
      return NextResponse.json({ ok:false, error:"NO_SAVED_CASES", message:"No saved test cases for this story. Click Save first." }, { status: 409 });
    }
    if (suite.dirty) {
      return NextResponse.json({ ok:false, error:"UNSAVED_CHANGES", message:"You have unsaved changes. Please click Save, then Publish." }, { status: 409 });
    }
    
    const cases = await prisma.testCase.findMany({ where: { suiteId }, orderBy: { order: "asc" } });

    const fresh = await getFreshAccessTokenForUser(userId);
    if (!fresh) return NextResponse.json({ ok:false, error:"UNAUTHORIZED", message:"Reconnect Jira" }, { status:401 });
    const { accessToken, cloudId } = fresh;
    const issueKey = suite.issueKey;

    if ((mode ?? "comment") === "comment") {
      // Build a readable Markdown summary inside a code block to preserve formatting.
      const md = renderMarkdownSuite(issueKey, suite.environment ?? undefined, cases);
      const body = doc([ paragraph(`Test Suite — ${issueKey}${suite.environment ? ` — ${suite.environment}` : ""}`), codeBlock(md) ]);

      const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ body })
      });
      if (!res.ok) {
        let detail: any = undefined;
        try {
          const responseText = await res.text();
          try { 
            detail = JSON.parse(responseText); 
          } catch { 
            detail = responseText.slice(0, 20000); 
          }
        } catch {}

        const errorMessage = res.status === 401 ? "Session expired. Reconnect Jira." :
                           res.status === 403 ? "You don't have permission to publish in this project." :
                           res.status === 404 ? "Parent issue not found on the active site." :
                           `Jira error ${res.status}.`;
        
        return NextResponse.json({ 
          ok: false, 
          error: res.status === 401 ? "UNAUTHORIZED" : 
                 res.status === 403 ? "FORBIDDEN" :
                 res.status === 404 ? "NOT_FOUND" : "JIRA_ERROR",
          status: res.status,
          message: errorMessage,
          detail: toDisplayDetail(detail),
          issueKey
        }, { status: res.status });
      }
      
      const commentData = await res.json();
      const baseUrl = `https://${cloudId}.atlassian.net`;
      const storyUrl = `${baseUrl}/browse/${issueKey}`;
      const commentUrl = `${storyUrl}?focusedCommentId=${commentData.id}&page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-${commentData.id}`;
      
      await prisma.testSuite.update({ where: { id: suiteId }, data: { status: "published" } });
      
      return NextResponse.json({ 
        ok: true, 
        mode: "comment",
        issueKey,
        commentId: commentData.id,
        storyUrl,
        commentUrl,
        message: "Published test cases as a single comment."
      });
    } else if (mode === "subtasks") {
      // Subtasks mode: create one sub-task per test case
      try {
        // 1. Get parent issue project information
        const issueResponse = await fetch(
          `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=project`,
          {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Accept": "application/json"
            }
          }
        );

        if (!issueResponse.ok) {
          if (issueResponse.status === 404) {
            return NextResponse.json({
              ok: false,
              error: "NOT_FOUND",
              message: "Parent issue not found on the active site.",
              issueKey
            }, { status: 404 });
          }
          if (issueResponse.status === 403) {
            return NextResponse.json({
              ok: false,
              error: "FORBIDDEN", 
              message: "You don't have permission to publish in this project.",
              issueKey
            }, { status: 403 });
          }
          throw new Error(`Failed to get issue: ${issueResponse.status}`);
        }

        const issueData = await issueResponse.json();
        const project = issueData.fields.project;
        
        // 2. Get available issue types to find sub-task type
        const issueTypesResponse = await fetch(
          `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issuetype`,
          {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Accept": "application/json"
            }
          }
        );

        if (!issueTypesResponse.ok) {
          throw new Error(`Failed to get issue types: ${issueTypesResponse.status}`);
        }

        const issueTypes = await issueTypesResponse.json();
        const subtaskType = issueTypes.find((type: any) => type.subtask === true);
        
        if (!subtaskType) {
          return NextResponse.json({
            ok: false,
            error: "NO_SUBTASK_TYPE",
            message: "This site has no 'Sub-task' issue type.",
            issueKey
          }, { status: 400 });
        }

        // 3. Priority mapping helper
        const mapPriority = (priority: string | null) => {
          const mapping: Record<string, string> = {
            'P0': process.env.JIRA_PRIORITY_P0 || 'Highest',
            'P1': process.env.JIRA_PRIORITY_P1 || 'High',
            'P2': process.env.JIRA_PRIORITY_P2 || 'Medium',
            'P3': process.env.JIRA_PRIORITY_P3 || 'Low'
          };
          return priority && mapping[priority] ? { name: mapping[priority] } : undefined;
        };

        // 4. Build ADF description for each case
        const buildTestCaseDescription = (testCase: any, issueKey: string, environment?: string) => {
          const steps = JSON.parse(testCase.stepsJson || "[]");
          const stepTexts = Array.isArray(steps) ? steps.map((step: any) => 
            typeof step === 'string' ? step : step.action || String(step)
          ) : [];

          return doc([
            heading(2, `${issueKey} – Test Case`),
            paragraphWithStrong("Environment: ", environment || "n/a"),
            heading(3, "Steps"),
            ...(stepTexts.length > 0 ? [orderedList(stepTexts)] : [paragraph("No steps defined")]),
            paragraphWithStrong("Expected: ", testCase.expected || "No expected result defined"),
            paragraph("Generated by QA CaseForge")
          ]);
        };

        // 5. Create sub-tasks with concurrency limit
        const created: Array<{ key: string; id: string }> = [];
        const extraLabels = process.env.JIRA_LABELS_EXTRA 
          ? process.env.JIRA_LABELS_EXTRA.split(',').map(l => l.trim())
          : [];

        // Process in batches of 3 for concurrency control
        for (let i = 0; i < cases.length; i += 3) {
          const batch = cases.slice(i, i + 3);
          const promises = batch.map(async (testCase: any) => {
            const priority = mapPriority(testCase.priority);
            const priorityLabel = priority ? priority.name : testCase.priority;
            const summary = `TC: ${testCase.title}${priorityLabel ? ` [${priorityLabel}]` : ""}`;
            const description = buildTestCaseDescription(testCase, issueKey, suite.environment ?? undefined);

            // Try creating subtask with different payload configurations
            const attemptCreateSubtask = async (fields: any) => {
              const response = await fetch(
                `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`,
                {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({ fields })
                }
              );
              return response;
            };

            // Configuration 1: Try minimal payload first (just required fields)
            console.log(`Creating subtask for: ${summary}`);
            let createResponse = await attemptCreateSubtask({
              project: { id: project.id },
              parent: { key: issueKey },
              issuetype: { id: subtaskType.id },
              summary
            });

            // Configuration 2: If minimal fails, try with description
            if (!createResponse.ok) {
              console.log('Minimal payload failed, trying with description...');
              createResponse = await attemptCreateSubtask({
                project: { id: project.id },
                parent: { key: issueKey },
                issuetype: { id: subtaskType.id },
                summary,
                description
              });
            }

            // Configuration 3: If still failing, try with all optional fields
            if (!createResponse.ok) {
              console.log('With description failed, trying full payload...');
              createResponse = await attemptCreateSubtask({
                project: { id: project.id },
                parent: { key: issueKey },
                issuetype: { id: subtaskType.id },
                summary,
                description,
                labels: ["caseforge", "generated-test-case", ...extraLabels].filter(Boolean),
                ...(priority ? { priority } : {})
              });
            }

            if (!createResponse.ok) {
              const errorData = await createResponse.json().catch(() => ({}));
              
              console.log('All subtask creation attempts failed:', {
                status: createResponse.status,
                errorData,
                testCaseTitle: testCase.title
              });
              
              if (createResponse.status === 400 && errorData.errors) {
                // Provide detailed info about missing fields
                const missingFields = Object.keys(errorData.errors);
                const fieldDetails = missingFields.map(field => 
                  `${field}: ${errorData.errors[field]}`
                ).join('; ');
                
                throw new Error(JSON.stringify({
                  type: "REQUIRED_FIELDS",
                  detail: errorData,
                  hint: `Project requires additional fields: ${fieldDetails}. Only summary, project, parent, and issuetype were provided.`
                }));
              }

              if (createResponse.status === 403) {
                throw new Error(JSON.stringify({
                  type: "FORBIDDEN",
                  message: "You don't have permission to create issues in this project."
                }));
              }

              if (createResponse.status === 404) {
                throw new Error(JSON.stringify({
                  type: "NOT_FOUND", 
                  message: "Parent issue not found on the active Jira site."
                }));
              }

              throw new Error(JSON.stringify({
                type: "JIRA_ERROR",
                status: createResponse.status,
                detail: errorData
              }));
            }

            const result = await createResponse.json();
            return { key: result.key, id: result.id };
          });

          const batchResults = await Promise.all(promises);
          created.push(...batchResults);
        }

        await prisma.testSuite.update({
          where: { id: suiteId },
          data: { status: "published" }
        });

        const baseUrl = `https://${cloudId}.atlassian.net`;
        const storyUrl = `${baseUrl}/browse/${issueKey}`;
        const createdWithUrls = created.map(item => ({
          key: item.key,
          url: `${baseUrl}/browse/${item.key}`
        }));

        return NextResponse.json({
          ok: true,
          mode: "subtasks",
          issueKey,
          count: created.length,
          created: createdWithUrls,
          storyUrl,
          message: `Created ${created.length} sub-task${created.length !== 1 ? 's' : ''} linked to ${issueKey}.`
        });

      } catch (error: any) {
        console.error('Subtasks creation error:', error);
        
        // Handle structured errors
        if (error.message.startsWith('{')) {
          try {
            const errorObj = JSON.parse(error.message);
            
            // Map error types to standard messages
            const messages = {
              "REQUIRED_FIELDS": "Project requires extra fields to create sub-tasks.",
              "FORBIDDEN": "You don't have permission to publish in this project.", 
              "NOT_FOUND": "Parent issue not found on the active site.",
              "JIRA_ERROR": `Jira error ${errorObj.status || 'unknown'}.`
            };
            
            return NextResponse.json({
              ok: false,
              error: errorObj.type,
              message: messages[errorObj.type as keyof typeof messages] || errorObj.message || errorObj.hint,
              detail: toDisplayDetail(errorObj.detail),
              issueKey
            }, { status: errorObj.type === "FORBIDDEN" ? 403 : 400 });
          } catch (e) {
            // Fall through to generic error
          }
        }

        return NextResponse.json({
          ok: false,
          error: "JIRA_ERROR", 
          message: "Jira error unknown.",
          detail: toDisplayDetail(error.message),
          issueKey
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({ ok: false, error: "INVALID_MODE" }, { status: 400 });
    }
  } catch (error) {
    console.error("Publish error:", error);
    
    let detail: any = undefined;
    if (error instanceof Error) {
      detail = {
        name: error.name,
        message: error.message,
        stack: error.stack?.slice(0, 1000)
      };
      
      if (error.message === "AUTH_REQUIRED") {
        return NextResponse.json({ 
          ok: false,
          error: "UNAUTHORIZED", 
          message: "Authentication required",
          detail: toDisplayDetail(detail)
        }, { status: 401 });
      }
    } else {
      detail = String(error).slice(0, 20000);
    }
    
    return NextResponse.json({
      ok: false,
      error: "INTERNAL_ERROR",
      message: "Failed to publish test cases",
      detail: toDisplayDetail(detail)
    }, { status: 500 });
  }
}

function renderMarkdownSuite(issueKey: string, env: string | undefined, cases: Array<{ title: string; stepsJson: any; expected: string; priority: string | null }>) {
  const mapPriorityToLabel = (priority: string | null): string => {
    if (!priority) return '';
    const mapping: Record<string, string> = {
      'P0': 'Critical',
      'P1': 'High', 
      'P2': 'Medium',
      'P3': 'Low'
    };
    return mapping[priority] || priority;
  };

  const lines: string[] = [];
  lines.push(`# Test Suite for ${issueKey}${env ? ` (${env})` : ""}`);
  lines.push("");
  cases.forEach((c, i) => {
    const priorityLabel = mapPriorityToLabel(c.priority);
    lines.push(`## ${i+1}. ${c.title}${priorityLabel ? ` [${priorityLabel}]` : ""}`);
    
    // Handle different stepsJson formats
    let steps: any[] = [];
    try {
      if (typeof c.stepsJson === 'string') {
        steps = JSON.parse(c.stepsJson);
      } else if (Array.isArray(c.stepsJson)) {
        steps = c.stepsJson;
      }
    } catch (e) {
      console.log('Failed to parse stepsJson:', e);
      steps = [];
    }
    
    if (steps.length) {
      lines.push(`- Steps:`);
      steps.forEach((step, idx) => {
        let stepText = '';
        if (typeof step === 'string') {
          stepText = step;
        } else if (step && typeof step === 'object') {
          stepText = step.action || String(step);
          if (step.expected) {
            stepText += ` (Expected: ${step.expected})`;
          }
        } else {
          stepText = String(step);
        }
        lines.push(`  ${idx+1}. ${stepText}`);
      });
    }
    lines.push(`- Expected: ${c.expected}`);
    lines.push("");
  });
  return lines.join("\n");
}