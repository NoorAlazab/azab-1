import { refreshJiraTokenIfNeeded } from "@/lib/server/jira/fetch";
import { requireActiveCloudIdOrThrow, callJiraApi } from "@/lib/server/jira/base";
import { getJiraConnection } from "@/lib/server/db/mock";
import type { SessionPayload } from "@/types/auth";

/**
 * Add a comment to a Jira issue using session context
 */
export async function addJiraComment(
  session: SessionPayload,
  issueKey: string,
  commentText: string
): Promise<string> {
  // Require active cloudId
  const { cloudId, siteName } = requireActiveCloudIdOrThrow(session);
  
  // Get Jira connection for access token
  const jiraConnection = await getJiraConnection(session.userId);
  if (!jiraConnection || !jiraConnection.accessTokenEncrypted) {
    const err = new Error("Jira connection not found") as Error & { code?: string };
    err.code = "NO_JIRA_CONNECTION";
    throw err;
  }

  const validToken = await refreshJiraTokenIfNeeded(jiraConnection.accessTokenEncrypted);

  const response = await callJiraApi(
    cloudId,
    `issue/${issueKey}/comment`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        body: {
          version: 1,
          type: "doc",
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
    },
    {
      issueKey,
      siteName,
      action: "add comment",
    }
  );

  const result = await response.json();
  return result.id;
}

/**
 * Add a simple text comment using v2 API (fallback for complex formatting)
 */
export async function addSimpleJiraComment(
  session: SessionPayload,
  issueKey: string,
  commentText: string
): Promise<string> {
  const { cloudId, siteName } = requireActiveCloudIdOrThrow(session);
  
  const jiraConnection = await getJiraConnection(session.userId);
  if (!jiraConnection || !jiraConnection.accessTokenEncrypted) {
    const err = new Error("Jira connection not found") as Error & { code?: string };
    err.code = "NO_JIRA_CONNECTION";
    throw err;
  }

  const validToken = await refreshJiraTokenIfNeeded(jiraConnection.accessTokenEncrypted);

  const response = await callJiraApi(
    cloudId,
    `/rest/api/2/issue/${issueKey}/comment`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        body: commentText,
      }),
    },
    {
      issueKey,
      siteName,
      action: "add simple comment",
    }
  );

  const result = await response.json();
  return result.id;
}