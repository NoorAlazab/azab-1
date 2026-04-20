// lib/jira/auth.ts - Database-based Jira authentication
import { prisma } from "@/lib/server/db/prisma";
import { JiraError } from "./errors";
import { getSession } from "@/lib/server/auth/iron";
import { decrypt } from "@/lib/server/crypto/secrets";
import { log } from '@/lib/utils/logger';

export interface JiraSession {
  accessToken: string;
  activeCloudId: string;
  activeSiteName: string;
}

export interface SessionData {
  userId?: string;
  jira?: {
    connected?: boolean;
    cloudId?: string;
  };
}

export async function getJiraSessionFromDB(): Promise<JiraSession | null> {
  try {
    log.debug('Getting session from database', { module: 'JiraAuth' });
    // Get session from Iron Session using the existing auth system
    const session = await getSession();
    log.debug('Session retrieved', { module: 'JiraAuth', hasUserId: !!session.userId });

    if (!session.userId) {
      log.debug('No userId in session', { module: 'JiraAuth' });
      return null;
    }

    // Get Jira tokens from database
    log.debug('Looking up jira token', { module: 'JiraAuth', userId: session.userId });
    const jiraToken = await prisma.jiraToken.findUnique({
      where: { userId: session.userId },
    });
    log.debug('Jira token lookup result', {
      module: 'JiraAuth',
      found: !!jiraToken,
      hasAccessToken: !!jiraToken?.accessToken,
      hasCloudId: !!jiraToken?.cloudId
    });

    if (!jiraToken || !jiraToken.accessToken || !jiraToken.cloudId) {
      log.debug('Missing jira token or required fields', { module: 'JiraAuth' });
      return null;
    }

    // Check if token is expired
    if (jiraToken.accessExpiresAt && jiraToken.accessExpiresAt < new Date()) {
      log.debug('Token expired', { module: 'JiraAuth', expiresAt: jiraToken.accessExpiresAt.toISOString() });
      return null;
    }

    log.debug('Successfully retrieved jira session', { module: 'JiraAuth', cloudId: jiraToken.cloudId });

    // Decrypt the access token before returning
    const decryptedToken = decrypt(jiraToken.accessToken);
    log.debug('Token decrypted successfully', { module: 'JiraAuth' });

    return {
      accessToken: decryptedToken,
      activeCloudId: jiraToken.cloudId,
      activeSiteName: 'Jira Site' // You might want to store site name in the database
    };

  } catch (error) {
    log.error('Failed to get Jira session from DB', error instanceof Error ? error : new Error(String(error)), { module: 'JiraAuth' });
    return null;
  }
}

// Returns the parsed Jira JSON. Caller is responsible for narrowing
// since payload shape varies per endpoint.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function makeJiraApiCallDB(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const session = await getJiraSessionFromDB();
  
  if (!session) {
    throw new JiraError({
      status: 401,
      message: "Jira authentication expired. Please reconnect your Jira account on the Dashboard.",
      type: 'auth'
    });
  }
  
  const url = `https://api.atlassian.com/ex/jira/${session.activeCloudId}/rest/api/3/${endpoint}`;
  log.debug('Making Jira API call', { module: 'JiraAuth', endpoint, cloudId: session.activeCloudId });

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    log.debug('Jira API response received', { module: 'JiraAuth', status: response.status, statusText: response.statusText });
    
    // Handle different error cases
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Could not read error body');
      log.debug('Jira API error response', { module: 'JiraAuth', status: response.status, errorBody });
      
      switch (response.status) {
        case 401:
          throw new JiraError({
            status: 401,
            message: "Jira authentication expired. Please reconnect your Jira account on the Dashboard.",
            type: 'auth'
          });
          
        case 403:
          throw new JiraError({
            status: 403,
            message: "Missing project permissions (Browse/Add Comments/Create Issues)",
            type: 'permission'
          });
          
        case 404:
          // Try to get available projects to help user
          let projectsHint = '';
          try {
            const projects = await fetch(`https://api.atlassian.com/ex/jira/${session.activeCloudId}/rest/api/3/project/search`, {
              headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json'
              }
            });
            
            if (projects.ok) {
              const projectsData = await projects.json();
              const projectKeys = projectsData.values?.map((p: { key: string }) => p.key).slice(0, 5) || [];
              if (projectKeys.length > 0) {
                projectsHint = ` Available project keys: ${projectKeys.join(', ')}`;
              }
            }
          } catch (e) {
            // Ignore projects fetch error
          }
          
          throw new JiraError({
            status: 404,
            message: `Issue not found on '${session.activeSiteName}'.${projectsHint} Check the issue key format.`,
            type: 'not_found'
          });
          
        case 429:
          throw new JiraError({
            status: 429,
            message: "Rate limit hit; retrying",
            type: 'rate_limit'
          });
          
        default:
          const errorText = await response.text().catch(() => 'Unknown error');
          log.error('Jira API error', new Error(`Status ${response.status}: ${errorText}`), { module: 'JiraAuth', status: response.status });
          throw new JiraError({
            status: response.status,
            message: `Jira API error (${response.status}): ${errorText}`,
            type: 'server'
          });
      }
    }
    
    return await response.json();
    
  } catch (error) {
    if (error instanceof JiraError) {
      throw error;
    }
    
    throw new JiraError({
      status: 500,
      message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'network'
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getJiraIssueDB(issueKey: string): Promise<any> {
  return await makeJiraApiCallDB(`issue/${issueKey}?expand=names,schema,transitions`);
}