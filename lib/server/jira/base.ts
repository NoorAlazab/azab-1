import type { SessionPayload } from "@/types/auth";
import { fetchWithRetry } from "@/lib/server/jira/retry";

/**
 * Get the base URL for Jira API calls using the cloudId
 */
export function jiraApiBaseFor(cloudId: string): string {
  // Atlassian Cloud 3LO must use ex/jira/<cloudId>
  return `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
}

/**
 * Alias for jiraApiBaseFor - simpler name for consistency
 */
export function jiraBase(cloudId: string): string {
  return jiraApiBaseFor(cloudId);
}

/**
 * Get the base URL for Jira API v2 calls (for legacy endpoints)
 */
export function jiraApiV2BaseFor(cloudId: string): string {
  return `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/2`;
}

/**
 * Require an active cloudId from session or throw structured error
 */
export function requireActiveCloudIdOrThrow(session: SessionPayload | null): { 
  cloudId: string; 
  siteName?: string; 
} {
  if (!session) {
    const err = new Error("No session found. Please log in.") as Error & { code?: string };
    err.code = "NO_SESSION";
    throw err;
  }

  const cloudId = session?.jira?.activeCloudId;
  if (!cloudId) {
    const siteCount = session?.jira?.sites?.length ?? 0;
    const hint = siteCount > 1 ? "Select a Jira site first." : "Connect Jira first.";
    const err = new Error(`No active Jira site. ${hint}`) as Error & { code?: string };
    err.code = "NO_ACTIVE_CLOUD_ID";
    throw err;
  }

  return { 
    cloudId, 
    siteName: session.jira?.activeSiteName ?? undefined 
  };
}

/**
 * Map Jira API errors to structured error objects
 */
export function mapJiraError(
  resp: Response, 
  context: { issueKey?: string; siteName?: string; action?: string } = {}
): { code: string; message: string; status: number } {
  const { status } = resp;
  const { issueKey, siteName, action = "operation" } = context;
  
  if (status === 401) {
    return { 
      code: "JIRA_UNAUTHORIZED", 
      message: "Jira authentication expired. Please reconnect Jira.", 
      status: 401 
    };
  }
  
  if (status === 403) {
    return { 
      code: "JIRA_FORBIDDEN", 
      message: `No permission for this ${action}. Check Browse Projects, Add Comments, or Create Issues permissions on this project.`, 
      status: 403 
    };
  }
  
  if (status === 404) {
    const siteHint = siteName ? ` on site "${siteName}"` : " on the active Jira site";
    const issueHint = issueKey ? `Issue "${issueKey}" not found` : "Resource not found";
    return { 
      code: "JIRA_NOT_FOUND", 
      message: `${issueHint}${siteHint}. Check the site selection and verify the resource exists.`, 
      status: 404 
    };
  }
  
  if (status === 429) {
    return { 
      code: "JIRA_RATE_LIMIT", 
      message: "Rate limit exceeded. Please wait and try again.", 
      status: 429 
    };
  }
  
  if (status === 400) {
    return { 
      code: "JIRA_BAD_REQUEST", 
      message: `Invalid request. Check the ${action} parameters.`, 
      status: 400 
    };
  }
  
  return { 
    code: "JIRA_ERROR", 
    message: `Jira ${action} failed with status ${status}.`, 
    status: status 
  };
}

/**
 * Enhanced Jira API call wrapper with error mapping
 */
export async function callJiraApi(
  cloudId: string,
  endpoint: string,
  options: RequestInit = {},
  context: { issueKey?: string; siteName?: string; action?: string } = {}
): Promise<Response> {
  const baseUrl = endpoint.includes('/rest/api/2/') 
    ? jiraApiV2BaseFor(cloudId)
    : jiraApiBaseFor(cloudId);
    
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}/${cleanEndpoint}`;
  
  const response = await fetchWithRetry(
    () =>
      fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers,
        },
      }),
    {
      onRetry: ({ attempt, delayMs, reason }) => {
        // eslint-disable-next-line no-console
        console.warn(
          `[jira] retrying ${context.action ?? 'request'} (${reason}) attempt=${attempt} after ${delayMs}ms`,
        );
      },
    },
  );

  if (!response.ok) {
    const error = mapJiraError(response, context);
    const errorObj = new Error(error.message) as Error & { code?: string; status?: number };
    errorObj.code = error.code;
    errorObj.status = error.status;
    throw errorObj;
  }

  return response;
}

/**
 * Get accessible Jira resources after OAuth
 */
export async function getAccessibleResources(accessToken: string) {
  const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get accessible resources: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get user information from Atlassian
 */
export async function getAtlassianUser(accessToken: string) {
  const response = await fetch('https://api.atlassian.com/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get user info: ${response.status}`);
  }
  
  return response.json();
}