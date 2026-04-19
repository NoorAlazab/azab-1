import { getJiraConnection } from "@/lib/db/mock";
import { requireActiveCloudIdOrThrow, callJiraApi } from "@/lib/jira/base";
import type { SessionPayload } from "@/types/auth";

/**
 * Refresh Jira token if needed and return a valid access token
 */
export async function refreshJiraTokenIfNeeded(currentToken: string): Promise<string> {
  // For now, assume the token is valid
  // In a real implementation, you would check token expiration and refresh if needed
  return currentToken;
}

/**
 * Fetch a Jira issue with authentication and proper error handling
 */
export async function fetchJiraIssue(
  session: SessionPayload,
  issueKey: string
) {
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
    `issue/${issueKey}?expand=names`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${validToken}`,
      },
    },
    {
      issueKey,
      siteName,
      action: "fetch issue",
    }
  );

  return response.json();
}

/**
 * Get Jira project information
 */
export async function fetchJiraProject(
  cloudId: string,
  projectKey: string,
  accessToken: string
) {
  const validToken = await refreshJiraTokenIfNeeded(accessToken);
  
  const response = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/${projectKey}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${validToken}`,
        "Accept": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch project: ${response.status}`);
  }

  return response.json();
}

/**
 * Get issue types for a project
 */
export async function fetchProjectIssueTypes(
  cloudId: string,
  projectKey: string,
  accessToken: string
) {
  const validToken = await refreshJiraTokenIfNeeded(accessToken);
  
  const response = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issuetype/project?projectId=${projectKey}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${validToken}`,
        "Accept": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch issue types: ${response.status}`);
  }

  return response.json();
}