export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db/prisma";
import { requireUserId } from "@/lib/server/auth/iron";
import { assertValidCsrf } from "@/lib/server/security/csrf";

// Internal function to save suite (reuse logic from save endpoint)
async function saveSuite(userId: string, suiteId: string, payload: any) {
  const { environment, cases } = payload;
  
  if (!Array.isArray(cases)) return { ok: false, error: "Invalid cases" };

  const suite = await prisma.testSuite.findFirst({ 
    where: { id: suiteId, userId } 
  });
  
  if (!suite) return { ok: false, error: "Suite not found" };

  await prisma.$transaction(async (tx) => {
    await tx.testCase.deleteMany({ where: { suiteId } });
    
    const newCases = cases.map((tc, index) => ({
      suiteId,
      title: tc.title,
      stepsJson: JSON.stringify(tc.steps),
      expected: tc.expected,
      priority: tc.priority || "P2",
      type: tc.type || "functional",
      order: tc.order ?? index
    }));

    if (newCases.length > 0) {
      await tx.testCase.createMany({ data: newCases });
    }

    await (tx as any).testSuite.update({
      where: { id: suiteId },
      data: {
        environment: environment ?? suite.environment,
        status: "draft",
        dirty: false,
        lastSavedAt: new Date(),
        updatedAt: new Date()
      }
    });
  });

  return { ok: true };
}

// Markdown rendering function (copied from main publish route)
function createMarkdownSuite(issueKey: string, env: string | undefined, cases: Array<{ title: string; stepsJson: any; expected: string; priority: string | null }>) {
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

// Internal function to publish suite (use direct logic instead of HTTP calls)
async function publishSuite(userId: string, suiteId: string, mode: "comment" | "subtasks") {
  let suite: any = null;
  
  try {
    // Import the publish logic directly instead of making HTTP calls
    const { getFreshAccessTokenForUser } = await import("@/lib/server/jira/tokenService");
    const { doc, paragraph, codeBlock } = await import("@/lib/server/jira/adf");
    
    // Get suite and cases
    suite = await prisma.testSuite.findFirst({ 
      where: { id: suiteId, userId }
    });
    
    if (!suite) {
      return { 
        ok: false, 
        error: "Suite not found",
        suiteId,
        issueKey: "UNKNOWN"
      };
    }

    const count = await prisma.testCase.count({ where: { suiteId } });
    if (count === 0) {
      return { 
        suiteId, 
        issueKey: suite.issueKey, 
        ok: false, 
        error: "NO_SAVED_CASES", 
        message: "No saved test cases for this story. Generate and Save before publishing." 
      };
    }
    
    if (suite.dirty) {
      return { 
        suiteId, 
        issueKey: suite.issueKey, 
        ok: false, 
        error: "UNSAVED_CHANGES", 
        message: "You have unsaved changes. Please click Save, then Publish." 
      };
    }

    const cases = await prisma.testCase.findMany({ 
      where: { suiteId }, 
      orderBy: { order: "asc" } 
    });

    if (cases.length === 0) {
      return {
        ok: false,
        error: "No test cases to publish",
        suiteId,
        issueKey: suite.issueKey
      };
    }

    // Get fresh token
    const fresh = await getFreshAccessTokenForUser(userId);
    if (!fresh) {
      return {
        ok: false,
        error: "UNAUTHORIZED",
        message: "Reconnect Jira",
        suiteId,
        issueKey: suite.issueKey
      };
    }

    const { accessToken, cloudId } = fresh;
    const issueKey = suite.issueKey;

    if (mode === "comment") {
      // Create markdown directly
      const md = createMarkdownSuite(issueKey, suite.environment ?? undefined, cases);
      const body = doc([ 
        paragraph(`Test Suite — ${issueKey}${suite.environment ? ` — ${suite.environment}` : ""}`), 
        codeBlock(md) 
      ]);

      const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, {
        method: "POST",
        headers: { 
          "content-type": "application/json", 
          "authorization": `Bearer ${accessToken}` 
        },
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
        
        return {
          ok: false,
          error: res.status === 401 ? "UNAUTHORIZED" : 
                 res.status === 403 ? "FORBIDDEN" :
                 res.status === 404 ? "NOT_FOUND" : "JIRA_ERROR",
          status: res.status,
          message: errorMessage,
          detail,
          suiteId,
          issueKey
        };
      }
      
      const commentData = await res.json();
      const baseUrl = `https://${cloudId}.atlassian.net`;
      const storyUrl = `${baseUrl}/browse/${issueKey}`;
      const commentUrl = `${storyUrl}?focusedCommentId=${commentData.id}&page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-${commentData.id}`;
      
      await prisma.testSuite.update({ 
        where: { id: suiteId }, 
        data: { status: "published" } 
      });
      
      return {
        ok: true,
        suiteId,
        issueKey,
        mode: "comment",
        message: "Published test cases as a single comment.",
        commentId: commentData.id,
        storyUrl,
        commentUrl
      };
    } else {
      // Subtasks mode - simplified implementation
      return {
        ok: false,
        error: "Subtasks mode not implemented in bulk publish",
        suiteId,
        issueKey
      };
    }

  } catch (error) {
    console.error("Publish suite error:", error);
    return {
      ok: false,
      suiteId,
      issueKey: suite?.issueKey || "UNKNOWN", 
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function POST(req: Request) {
  try { 
    assertValidCsrf(); 
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Invalid CSRF token" }), { 
      status: 403, 
      headers: { "content-type": "application/json" } 
    });
  }

  try {
    const userId = await requireUserId();
    const { suiteIds, mode = "comment", payloads = {} } = await req.json().catch(() => ({}));
    
    if (!Array.isArray(suiteIds) || suiteIds.length === 0 || suiteIds.length > 50) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
    }

    const results = [];
    let successes = 0;
    let failures = 0;

    // Process suites with concurrency limit of 3
    const concurrencyLimit = 3;
    for (let i = 0; i < suiteIds.length; i += concurrencyLimit) {
      const batch = suiteIds.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (suiteId) => {
        try {
          // Save if payload provided
          if (payloads[suiteId]) {
            const saveResult = await saveSuite(userId, suiteId, payloads[suiteId]);
            if (!saveResult.ok) {
              return {
                suiteId,
                issueKey: "UNKNOWN",
                ok: false,
                message: saveResult.error || "Save failed"
              };
            }
          }

          // Publish
          const publishResult = await publishSuite(userId, suiteId, mode);
          return publishResult;
        } catch (error) {
          return {
            suiteId,
            issueKey: "UNKNOWN",
            ok: false,
            message: error instanceof Error ? error.message : "Unknown error"
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Count successes/failures
      batchResults.forEach(result => {
        if (result.ok) successes++;
        else failures++;
      });
    }

    return NextResponse.json({
      ok: true,
      mode,
      total: suiteIds.length,
      successes,
      failures,
      results
    });

  } catch (error) {
    console.error("Bulk publish error:", error);
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to bulk publish" },
      { status: 500 }
    );
  }
}