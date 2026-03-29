import { getJiraConnection } from "@/lib/db/database";
import { makeAtlassianApiRequest, decryptToken } from "@/lib/oauth/atlassian";
import type { Bug, BugEvidence } from "./types";

/**
 * Format bug evidence for Jira comment/description
 */
function formatBugForJira(bug: Bug): string {
  let markdown = `*Severity:* ${bug.severity.toUpperCase()}\n`;
  markdown += `*Category:* ${bug.category.replace('_', ' ')}\n\n`;
  markdown += `h3. Description\n${bug.description}\n\n`;

  if (bug.evidence.length > 0) {
    markdown += `h3. Evidence\n`;

    for (const evidence of bug.evidence) {
      if (evidence.type === "console_log") {
        markdown += `*Console Log:*\n{code}\n${evidence.content}\n{code}\n\n`;
      } else if (evidence.type === "network_log") {
        markdown += `*Network Log:*\n{code}\n${evidence.content}\n{code}\n\n`;
      } else if (evidence.type === "screenshot") {
        markdown += `*Screenshot:* (attached)\n`;
      }
    }
  }

  markdown += `\n_Bug discovered during automated exploration_`;

  return markdown;
}

/**
 * Convert markdown to Atlassian Document Format (ADF)
 * This is a simplified version - in production, use a proper converter
 */
function markdownToADF(markdown: string): any {
  const lines = markdown.split('\n');
  const content: any[] = [];

  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === '{code}') {
      if (inCodeBlock) {
        // End code block
        content.push({
          type: 'codeBlock',
          content: [{
            type: 'text',
            text: codeLines.join('\n'),
          }],
        });
        codeLines = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.trim() === '') {
      continue;
    }

    if (line.startsWith('h3. ')) {
      content.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: line.substring(4) }],
      });
    } else if (line.startsWith('*') && line.endsWith('*') && !line.includes(' ')) {
      // Bold text (e.g., *Severity:*)
      const parts = line.split('*').filter(p => p);
      const textContent = parts.map((part, i) => {
        if (i % 2 === 0) {
          return { type: 'text', text: part };
        } else {
          return { type: 'text', text: part, marks: [{ type: 'strong' }] };
        }
      });
      content.push({
        type: 'paragraph',
        content: textContent,
      });
    } else {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line }],
      });
    }
  }

  return {
    version: 1,
    type: 'doc',
    content,
  };
}

/**
 * Publish bug as a comment on the original Jira story
 */
export async function publishBugAsComment(
  userId: string,
  bug: Bug,
  storyKey: string
): Promise<{ success: boolean; commentId?: string; error?: string }> {
  try {
    // Get Jira connection
    const jiraConnection = await getJiraConnection(userId);
    if (!jiraConnection) {
      return { success: false, error: "Jira connection not found" };
    }

    if (!jiraConnection.activeCloudId) {
      return { success: false, error: "No active Jira site selected" };
    }

    // Format bug as markdown
    const markdown = formatBugForJira(bug);

    // Convert to ADF
    const adfContent = markdownToADF(markdown);

    // Add comment to issue
    const accessToken = decryptToken(jiraConnection.accessTokenEncrypted || "");
    const commentUrl = `https://api.atlassian.com/ex/jira/${jiraConnection.activeCloudId}/rest/api/3/issue/${storyKey}/comment`;

    const response = await makeAtlassianApiRequest(accessToken, commentUrl, {
      method: "POST",
      body: JSON.stringify({
        body: adfContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Jira API error: ${response.status} ${error}` };
    }

    const data = await response.json();

    return {
      success: true,
      commentId: data.id,
    };
  } catch (error) {
    console.error("Publish bug as comment error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Publish bug as a new Jira issue (bug ticket) linked to the story
 */
export async function publishBugAsTicket(
  userId: string,
  bug: Bug,
  storyKey: string
): Promise<{ success: boolean; issueKey?: string; error?: string }> {
  try {
    // Get Jira connection
    const jiraConnection = await getJiraConnection(userId);
    if (!jiraConnection) {
      return { success: false, error: "Jira connection not found" };
    }

    if (!jiraConnection.activeCloudId) {
      return { success: false, error: "No active Jira site selected" };
    }

    // Extract project key from story key (e.g., "ABC-123" -> "ABC")
    const projectKey = storyKey.split('-')[0];

    // Format bug description
    const markdown = formatBugForJira(bug);
    const adfContent = markdownToADF(markdown);

    // Map bug severity to Jira priority
    const priorityMap: Record<string, string> = {
      critical: "Highest",
      high: "High",
      medium: "Medium",
      low: "Low",
    };

    // Create new bug issue
    const accessToken = decryptToken(jiraConnection.accessTokenEncrypted || "");
    const issueUrl = `https://api.atlassian.com/ex/jira/${jiraConnection.activeCloudId}/rest/api/3/issue`;

    const issueData = {
      fields: {
        project: {
          key: projectKey,
        },
        summary: bug.title,
        description: adfContent,
        issuetype: {
          name: "Bug",
        },
        priority: {
          name: priorityMap[bug.severity] || "Medium",
        },
      },
    };

    const createResponse = await makeAtlassianApiRequest(accessToken, issueUrl, {
      method: "POST",
      body: JSON.stringify(issueData),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      return { success: false, error: `Failed to create bug: ${createResponse.status} ${error}` };
    }

    const createdIssue = await createResponse.json();
    const newIssueKey = createdIssue.key;

    // Link the bug to the original story
    const linkUrl = `https://api.atlassian.com/ex/jira/${jiraConnection.activeCloudId}/rest/api/3/issueLink`;

    const linkData = {
      type: {
        name: "Relates",
      },
      inwardIssue: {
        key: newIssueKey,
      },
      outwardIssue: {
        key: storyKey,
      },
      comment: {
        body: markdownToADF("Bug discovered during automated exploration"),
      },
    };

    const linkResponse = await makeAtlassianApiRequest(accessToken, linkUrl, {
      method: "POST",
      body: JSON.stringify(linkData),
    });

    if (!linkResponse.ok) {
      console.warn("Failed to link bug to story:", await linkResponse.text());
      // Don't fail the whole operation if linking fails
    }

    return {
      success: true,
      issueKey: newIssueKey,
    };
  } catch (error) {
    console.error("Publish bug as ticket error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Upload screenshot to Jira issue as attachment
 */
export async function uploadScreenshotToJira(
  userId: string,
  issueKey: string,
  screenshot: BugEvidence
): Promise<{ success: boolean; error?: string }> {
  if (screenshot.type !== "screenshot") {
    return { success: false, error: "Evidence is not a screenshot" };
  }

  try {
    const jiraConnection = await getJiraConnection(userId);
    if (!jiraConnection || !jiraConnection.activeCloudId) {
      return { success: false, error: "Jira connection not found" };
    }

    // Convert base64 to blob
    const base64Data = screenshot.content.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const accessToken = decryptToken(jiraConnection.accessTokenEncrypted || "");
    const attachmentUrl = `https://api.atlassian.com/ex/jira/${jiraConnection.activeCloudId}/rest/api/3/issue/${issueKey}/attachments`;

    // Create form data
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/png' });
    formData.append('file', blob, `screenshot-${Date.now()}.png`);

    const response = await fetch(attachmentUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "X-Atlassian-Token": "no-check",
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Failed to upload: ${response.status} ${error}` };
    }

    return { success: true };
  } catch (error) {
    console.error("Upload screenshot error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
