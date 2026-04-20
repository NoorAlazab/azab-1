import { refreshJiraTokenIfNeeded } from "@/lib/server/jira/fetch";
import { formatTestCaseMarkdown } from "@/lib/server/jira/markdown";
import { requireActiveCloudIdOrThrow, callJiraApi } from "@/lib/server/jira/base";
import { getJiraConnection } from "@/lib/server/db/mock";
import type { TestCase, TestPriority } from "@/lib/server/generator/types";
import type { SessionPayload } from "@/types/auth";

/**
 * Map our test priorities to Jira priority IDs
 */
const PRIORITY_MAPPING: Record<TestPriority, string> = {
  "P0": "1", // Highest
  "P1": "2", // High  
  "P2": "3", // Medium
  "P3": "4", // Low
};

/**
 * Fetch project information
 */
async function fetchProject(cloudId: string, projectKey: string, accessToken: string, siteName?: string) {
  const response = await callJiraApi(
    cloudId,
    `project/${projectKey}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    },
    {
      siteName,
      action: "fetch project",
    }
  );
  
  return response.json();
}

/**
 * Fetch issue types for a project
 */
async function fetchIssueTypes(cloudId: string, projectKey: string, accessToken: string, siteName?: string) {
  const response = await callJiraApi(
    cloudId,
    `issuetype/project?projectId=${projectKey}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    },
    {
      siteName,
      action: "fetch issue types",
    }
  );
  
  return response.json();
}

/**
 * Create Jira subtasks for test cases
 */
export async function createJiraSubtasks(
  session: SessionPayload,
  parentIssueKey: string,
  testCases: TestCase[]
): Promise<Array<{ key: string; id: string }>> {
  const { cloudId, siteName } = requireActiveCloudIdOrThrow(session);
  
  const jiraConnection = await getJiraConnection(session.userId);
  if (!jiraConnection || !jiraConnection.accessTokenEncrypted) {
    const err: any = new Error("Jira connection not found");
    err.code = "NO_JIRA_CONNECTION";
    throw err;
  }
  
  const validToken = await refreshJiraTokenIfNeeded(jiraConnection.accessTokenEncrypted);
  
  // Extract project key from issue key (e.g., "ABC-123" -> "ABC")
  const projectKey = parentIssueKey.split("-")[0];
  
  // Get project info and subtask issue type
  const [project, issueTypes] = await Promise.all([
    fetchProject(cloudId, projectKey, validToken, siteName),
    fetchIssueTypes(cloudId, projectKey, validToken, siteName),
  ]);
  
  // Find subtask issue type
  const subtaskType = issueTypes.find((type: any) => type.subtask === true);
  if (!subtaskType) {
    const err: any = new Error("No subtask issue type found for this project");
    err.code = "NO_SUBTASK_TYPE";
    throw err;
  }
  
  const createdSubtasks: Array<{ key: string; id: string }> = [];
  
  // Create subtasks with rate limiting (batch of 5)
  const batchSize = 5;
  for (let i = 0; i < testCases.length; i += batchSize) {
    const batch = testCases.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (testCase, index) => {
      const subtaskData = {
        fields: {
          project: { key: projectKey },
          parent: { key: parentIssueKey },
          issuetype: { id: subtaskType.id },
          summary: `Test: ${testCase.title}`,
          description: formatTestCaseMarkdown(testCase),
          priority: { id: PRIORITY_MAPPING[testCase.priority] || "3" },
          labels: ["auto-testcase", "qa-caseforge", ...(testCase.tags || [])],
        },
      };
      
      const response = await callJiraApi(
        cloudId,
        "issue",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${validToken}`,
          },
          body: JSON.stringify(subtaskData),
        },
        {
          siteName,
          action: "create subtask",
        }
      );
      
      const result = await response.json();
      return { key: result.key, id: result.id };
    });
    
    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    createdSubtasks.push(...batchResults);
    
    // Add delay between batches to respect rate limits
    if (i + batchSize < testCases.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return createdSubtasks;
}

/**
 * Get available priorities for a Jira project
 */
export async function getJiraPriorities(
  cloudId: string,
  accessToken: string
): Promise<Array<{ id: string; name: string }>> {
  const validToken = await refreshJiraTokenIfNeeded(accessToken);
  
  const response = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/priority`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${validToken}`,
        "Accept": "application/json",
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch priorities: ${response.status}`);
  }
  
  const priorities = await response.json();
  return priorities.map((p: any) => ({ id: p.id, name: p.name }));
}