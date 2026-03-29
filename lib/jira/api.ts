// lib/jira/api.ts - Jira API integration with proper error handling
import { ENV } from "@/lib/env";

export interface JiraApiError {
  status: number;
  message: string;
  type: 'auth' | 'permission' | 'not_found' | 'rate_limit' | 'server' | 'network';
}

export class JiraError extends Error {
  constructor(public jiraError: JiraApiError) {
    super(jiraError.message);
    this.name = 'JiraError';
  }
}

export interface JiraSession {
  accessToken: string;
  activeCloudId: string;
  activeSiteName: string;
}

function getJiraSession(request: Request): JiraSession | null {
  // Get session from cookies  
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  
  const jiraSessionCookie = cookieHeader
    .split(';')
    .find(c => c.trim().startsWith('jira_session='));
    
  if (!jiraSessionCookie) return null;
  
  try {
    const sessionData = JSON.parse(decodeURIComponent(jiraSessionCookie.split('=')[1]));
    const jira = sessionData.jira;
    
    if (!jira?.connected || !jira.accessToken) {
      return null;
    }
    
    // Guard: require activeCloudId for Jira calls
    if (!jira.activeCloudId) {
      throw new JiraError({
        status: 400,
        message: "Select a Jira site first.",
        type: 'auth'
      });
    }
    
    return {
      accessToken: jira.accessToken,
      activeCloudId: jira.activeCloudId,
      activeSiteName: jira.activeSiteName || 'Unknown Site'
    };
  } catch (error) {
    if (error instanceof JiraError) {
      throw error; // Re-throw Jira errors
    }
    return null;
  }
}

export async function makeJiraApiCall(
  request: Request,
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const session = getJiraSession(request);
  
  if (!session) {
    throw new JiraError({
      status: 401,
      message: "Reconnect Jira",
      type: 'auth'
    });
  }
  
  const url = `https://api.atlassian.com/ex/jira/${session.activeCloudId}/rest/api/3/${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  // Handle different error cases
  if (!response.ok) {
    switch (response.status) {
      case 401:
        throw new JiraError({
          status: 401,
          message: "Reconnect Jira",
          type: 'auth'
        });
        
      case 403:
        throw new JiraError({
          status: 403,
          message: "Missing project permissions (Browse/Add Comments/Create Issues)",
          type: 'permission'
        });
        
      case 404:
        throw new JiraError({
          status: 404,
          message: `Issue not found on active site '${session.activeSiteName}' (wrong site or key)`,
          type: 'not_found'
        });
        
      case 429:
        throw new JiraError({
          status: 429,
          message: "Rate limit hit; retrying",
          type: 'rate_limit'
        });
        
      default:
        const errorText = await response.text();
        throw new JiraError({
          status: response.status,
          message: `Jira API error: ${errorText}`,
          type: 'server'
        });
    }
  }
  
  return response.json();
}

export async function getJiraIssue(request: Request, issueKey: string) {
  const fields = ['summary', 'description'];
  
  // Add acceptance criteria field if configured
  if (ENV.JIRA_AC_FIELD_ID) {
    fields.push(ENV.JIRA_AC_FIELD_ID);
  }
  
  const fieldsParam = fields.join(',');
  const issue = await makeJiraApiCall(request, `issue/${issueKey}?fields=${fieldsParam}`);
  
  // Normalize response
  return {
    key: issue.key,
    summary: issue.fields.summary,
    description: issue.fields.description?.content 
      ? extractTextFromADF(issue.fields.description) 
      : issue.fields.description || '',
    acceptanceCriteria: ENV.JIRA_AC_FIELD_ID 
      ? issue.fields[ENV.JIRA_AC_FIELD_ID] || ''
      : '',
    status: issue.fields.status?.name || 'Unknown',
    projectKey: issue.key.split('-')[0]
  };
}

export async function addCommentToIssue(request: Request, issueKey: string, markdown: string) {
  // Convert Markdown to Atlassian Document Format (ADF)
  const adfContent = markdownToADF(markdown);
  
  const comment = {
    body: adfContent
  };
  
  return await makeJiraApiCall(request, `issue/${issueKey}/comment`, {
    method: 'POST',
    body: JSON.stringify(comment)
  });
}

// Helper function to extract plain text from Atlassian Document Format
function extractTextFromADF(adf: any): string {
  if (!adf || !adf.content) return '';
  
  function extractFromContent(content: any[]): string {
    return content.map(node => {
      if (node.type === 'text') {
        return node.text || '';
      } else if (node.content) {
        return extractFromContent(node.content);
      }
      return '';
    }).join(' ');
  }
  
  return extractFromContent(adf.content).trim();
}

// Helper function to convert Markdown to Atlassian Document Format
function markdownToADF(markdown: string): any {
  // Simple conversion - in production, use a proper markdown-to-ADF library
  const lines = markdown.split('\n');
  const content: any[] = [];
  
  lines.forEach(line => {
    if (line.trim() === '') {
      return; // Skip empty lines
    }
    
    if (line.startsWith('# ')) {
      content.push({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: line.substring(2) }]
      });
    } else if (line.startsWith('## ')) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: line.substring(3) }]
      });
    } else if (line.startsWith('- ')) {
      if (content[content.length - 1]?.type !== 'bulletList') {
        content.push({
          type: 'bulletList',
          content: []
        });
      }
      content[content.length - 1].content.push({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: line.substring(2) }]
        }]
      });
    } else {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line }]
      });
    }
  });
  
  return {
    version: 1,
    type: 'doc',
    content
  };
}