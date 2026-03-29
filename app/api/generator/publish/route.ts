import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { getJiraConnection } from "@/lib/db/mock";
import { decryptToken, refreshAccessToken, encryptToken } from "@/lib/oauth/atlassian";
import { saveJiraConnection } from "@/lib/db/mock";
import { PublishBodySchema } from "@/lib/generator/validators";
import type { PublishResponse, TestCase, WriteMode } from "@/lib/generator/types";

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = PublishBodySchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { issueKey, cases, mode: writeMode } = validation.data;

    // Get Jira connection
    const jiraConnection = await getJiraConnection(userId);
    if (!jiraConnection) {
      return NextResponse.json(
        { error: "Jira not connected" },
        { status: 404 }
      );
    }

    if (!jiraConnection.accessTokenEncrypted) {
      return NextResponse.json(
        { error: "No access token available" },
        { status: 401 }
      );
    }

    let accessToken = decryptToken(jiraConnection.accessTokenEncrypted);

    // Check if token needs refresh
    if (jiraConnection.expiresAt && jiraConnection.expiresAt <= new Date()) {
      try {
        if (!jiraConnection.refreshTokenEncrypted) {
          return NextResponse.json(
            { error: "No refresh token available" },
            { status: 401 }
          );
        }
        const refreshToken = decryptToken(jiraConnection.refreshTokenEncrypted);
        const newTokens = await refreshAccessToken(refreshToken);
        
        // Update stored tokens
        const updatedConnection = {
          ...jiraConnection,
          accessTokenEncrypted: encryptToken(newTokens.access_token),
          refreshTokenEncrypted: encryptToken(newTokens.refresh_token),
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
          updatedAt: new Date(),
        };
        await saveJiraConnection(updatedConnection);
        accessToken = newTokens.access_token;
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        return NextResponse.json(
          { error: "Token refresh failed. Please reconnect Jira." },
          { status: 401 }
        );
      }
    }

    // Ensure we have an active cloud ID
    if (!jiraConnection.activeCloudId) {
      return NextResponse.json(
        { error: "No active Jira site selected" },
        { status: 400 }
      );
    }

    // Publish test cases based on write mode
    if (writeMode === "comment") {
      return await publishAsComment(accessToken, jiraConnection.activeCloudId, issueKey, cases);
    } else {
      return await publishAsSubtasks(accessToken, jiraConnection.activeCloudId, issueKey, cases);
    }
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json(
      { error: "Failed to publish test cases" },
      { status: 500 }
    );
  }
}

async function publishAsComment(
  accessToken: string,
  cloudId: string,
  issueKey: string,
  cases: TestCase[]
): Promise<NextResponse> {
  try {
    // Format test cases as comment text
    const commentText = formatTestCasesAsComment(cases);

    // Create comment via Jira API
    const commentResponse = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}/comment`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          body: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: commentText,
                  },
                ],
              },
            ],
          },
        }),
      }
    );

    if (!commentResponse.ok) {
      const errorText = await commentResponse.text();
      console.error("Jira comment creation failed:", {
        status: commentResponse.status,
        statusText: commentResponse.statusText,
        body: errorText,
      });
      
      return NextResponse.json(
        { error: "Failed to create comment in Jira" },
        { status: commentResponse.status }
      );
    }

    const comment = await commentResponse.json();

    const response: PublishResponse = {
      ok: true,
      mode: "comment",
      commentId: comment.id,
      metadata: {
        totalCases: cases.length,
        publishedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Comment publish error:", error);
    return NextResponse.json(
      { error: "Failed to publish as comment" },
      { status: 500 }
    );
  }
}

async function publishAsSubtasks(
  accessToken: string,
  cloudId: string,
  issueKey: string,
  cases: TestCase[]
): Promise<NextResponse> {
  try {
    // Get parent issue details to extract project key and issue type info
    const issueResponse = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!issueResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch parent issue details" },
        { status: issueResponse.status }
      );
    }

    const parentIssue = await issueResponse.json();
    const projectKey = parentIssue.fields.project.key;

    // Create subtasks for each test case
    const createdSubtasks = [];

    for (const testCase of cases) {
      const subtaskData = {
        fields: {
          project: { key: projectKey },
          parent: { key: issueKey },
          summary: testCase.title,
          description: formatTestCaseAsDescription(testCase),
          issuetype: { name: "Sub-task" }, // This might need to be "Subtask" depending on Jira instance
          priority: mapPriorityToJira(testCase.priority),
        },
      };

      const subtaskResponse = await fetch(
        `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(subtaskData),
        }
      );

      if (subtaskResponse.ok) {
        const subtask = await subtaskResponse.json();
        createdSubtasks.push({
          key: subtask.key,
          id: subtask.id,
          title: testCase.title,
        });
      } else {
        console.error("Failed to create subtask:", {
          testCase: testCase.title,
          status: subtaskResponse.status,
          statusText: subtaskResponse.statusText,
        });
      }
    }

    const response: PublishResponse = {
      ok: true,
      mode: "subtasks",
      created: createdSubtasks,
      metadata: {
        totalCases: cases.length,
        publishedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Subtasks publish error:", error);
    return NextResponse.json(
      { error: "Failed to publish as subtasks" },
      { status: 500 }
    );
  }
}

function formatTestCasesAsComment(cases: TestCase[]): string {
  const mapPriorityToLabel = (priority: string): string => {
    const mapping: Record<string, string> = {
      'P0': 'Critical',
      'P1': 'High', 
      'P2': 'Medium',
      'P3': 'Low'
    };
    return mapping[priority] || priority;
  };

  let text = `# Generated Test Cases (${cases.length} total)\n\n`;
  
  cases.forEach((testCase, index) => {
    text += `## ${index + 1}. ${testCase.title}\n\n`;
    
    if (testCase.description) {
      text += `**Description:** ${testCase.description}\n\n`;
    }
    
    text += `**Type:** ${testCase.type} | **Priority:** ${mapPriorityToLabel(testCase.priority)}\n\n`;
    
    if (testCase.preconditions && testCase.preconditions.length > 0) {
      text += `**Preconditions:**\n`;
      testCase.preconditions.forEach(condition => {
        text += `- ${condition}\n`;
      });
      text += `\n`;
    }
    
    text += `**Test Steps:**\n`;
    testCase.steps.forEach((step, stepIndex) => {
      text += `${stepIndex + 1}. **Action:** ${step.action}\n`;
      text += `   **Expected:** ${step.expected}\n`;
    });
    text += `\n`;
    
    text += `**Overall Expected Result:** ${testCase.expected}\n\n`;
    
    if (testCase.tags && testCase.tags.length > 0) {
      text += `**Tags:** ${testCase.tags.join(', ')}\n\n`;
    }
    
    text += `---\n\n`;
  });
  
  return text;
}

function formatTestCaseAsDescription(testCase: TestCase): string {
  const mapPriorityToLabel = (priority: string): string => {
    const mapping: Record<string, string> = {
      'P0': 'Critical',
      'P1': 'High', 
      'P2': 'Medium',
      'P3': 'Low'
    };
    return mapping[priority] || priority;
  };

  let description = "";
  
  if (testCase.description) {
    description += `${testCase.description}\n\n`;
  }
  
  description += `**Type:** ${testCase.type} | **Priority:** ${mapPriorityToLabel(testCase.priority)}\n\n`;
  
  if (testCase.preconditions && testCase.preconditions.length > 0) {
    description += `**Preconditions:**\n`;
    testCase.preconditions.forEach(condition => {
      description += `- ${condition}\n`;
    });
    description += `\n`;
  }
  
  description += `**Test Steps:**\n`;
  testCase.steps.forEach((step, index) => {
    description += `${index + 1}. **Action:** ${step.action}\n`;
    description += `   **Expected:** ${step.expected}\n`;
  });
  description += `\n`;
  
  description += `**Overall Expected Result:** ${testCase.expected}\n\n`;
  
  if (testCase.tags && testCase.tags.length > 0) {
    description += `**Tags:** ${testCase.tags.join(', ')}\n`;
  }
  
  return description;
}

function mapPriorityToJira(priority: string): { name: string } {
  const priorityMap: Record<string, string> = {
    critical: "Highest",
    high: "High", 
    medium: "Medium",
    low: "Low",
  };
  
  return { name: priorityMap[priority] || "Medium" };
}