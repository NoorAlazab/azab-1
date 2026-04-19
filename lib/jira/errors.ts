/**
 * Enhanced error mapping for Jira API responses
 */

export interface JiraApiError extends Error {
  code: string;
  status: number;
  context?: {
    issueKey?: string;
    siteName?: string;
    action?: string;
  };
}

export function createJiraError(
  code: string,
  message: string,
  status: number,
  context?: { issueKey?: string; siteName?: string; action?: string }
): JiraApiError {
  const error = new Error(message) as JiraApiError;
  error.code = code;
  error.status = status;
  error.context = context;
  return error;
}

/**
 * Map HTTP status codes to user-friendly error messages
 */
export function mapJiraApiError(
  response: Response,
  context: { issueKey?: string; siteName?: string; action?: string } = {}
): JiraApiError {
  const { status } = response;
  const { issueKey, siteName, action = "operation" } = context;
  
  switch (status) {
    case 401:
      return createJiraError(
        "JIRA_AUTH_EXPIRED",
        "Jira auth expired. Reconnect Jira.",
        401,
        context
      );
      
    case 403:
      return createJiraError(
        "JIRA_PERMISSION_DENIED", 
        "Missing project permission (Browse/Add Comments/Create Issues).",
        403,
        context
      );
      
    case 404: {
      const siteHint = siteName ? ` on site "${siteName}"` : "";
      const resourceHint = issueKey ? `Issue "${issueKey}" not found` : "Resource not found";
      return createJiraError(
        "JIRA_NOT_FOUND",
        `${resourceHint}${siteHint}. Check site selection and key.`,
        404,
        context
      );
    }
    
    case 429:
      return createJiraError(
        "JIRA_RATE_LIMIT",
        "Rate limit hit. Retrying.",
        429,
        context
      );
      
    case 400:
      return createJiraError(
        "JIRA_BAD_REQUEST",
        `Invalid ${action} request. Check parameters.`,
        400,
        context
      );
      
    case 500:
    case 502:
    case 503:
    case 504:
      return createJiraError(
        "JIRA_SERVER_ERROR",
        "Jira server error. Please try again later.",
        status,
        context
      );
      
    default:
      return createJiraError(
        "JIRA_UNKNOWN_ERROR",
        `Jira ${action} failed with status ${status}.`,
        status,
        context
      );
  }
}

/**
 * Check if an error is a specific Jira error type
 */
export function isJiraError(error: any, code?: string): error is JiraApiError {
  if (!error || typeof error !== 'object' || !error.code) {
    return false;
  }
  
  if (code) {
    return error.code === code;
  }
  
  return error.code?.startsWith('JIRA_') === true;
}

/**
 * Extract user-friendly message from any error
 */
export function getErrorMessage(error: any, fallback = "An unexpected error occurred"): string {
  if (isJiraError(error)) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return fallback;
}

/**
 * Retry configuration for rate limit errors
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
};

/**
 * Calculate retry delay for rate limit errors
 */
export function calculateRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt - 1);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

/**
 * Check if an error should be retried
 */
export function shouldRetryError(error: any): boolean {
  return isJiraError(error, "JIRA_RATE_LIMIT") || 
         isJiraError(error, "JIRA_SERVER_ERROR");
}

/**
 * Categorical Jira error wrapper, migrated from the deleted
 * lib/jira/api.ts. Distinct from the JiraApiError interface above:
 * JiraError is a concrete Error subclass that carries a structured
 * payload, used by lib/jira/auth.ts (makeJiraApiCallDB) and the route
 * handlers that catch Jira failures and translate them into HTTP
 * responses.
 *
 * The original `JiraApiError` interface (extending Error, with `.code`)
 * is preserved above for any future caller that wants to use the
 * mapJiraApiError() helper.
 */
export type JiraErrorCategory =
  | "auth"
  | "permission"
  | "not_found"
  | "rate_limit"
  | "server"
  | "network";

export interface JiraErrorPayload {
  status: number;
  message: string;
  type: JiraErrorCategory;
}

export class JiraError extends Error {
  constructor(public jiraError: JiraErrorPayload) {
    super(jiraError.message);
    this.name = "JiraError";
  }
}