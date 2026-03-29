import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { getJiraConnection } from "@/lib/db/database";
import { makeAtlassianApiRequest, decryptToken } from "@/lib/oauth/atlassian";
import { validateJiraStoryKey } from "@/lib/exploration/service";

interface AnalysisRequest {
  storyKey: string;
}

interface AnalysisResponse {
  envUrl: string | null;
  auth: {
    username: string | null;
    password: string | null;
  } | null;
  testScenarios: string[];
  rawStory: {
    key: string;
    summary: string;
    description: string;
    acceptanceCriteria: string;
  };
}

/**
 * Extract URLs from text using regex
 */
function extractUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlPattern) || [];
  return matches.filter(url => {
    const lower = url.toLowerCase();
    return !lower.includes('jira.') &&
           !lower.includes('confluence.') &&
           !lower.includes('atlassian.') &&
           !lower.includes('github.') &&
           !lower.includes('localhost');
  });
}

/**
 * Extract environment URL from story content
 */
function extractEnvironmentUrl(description: string, acceptanceCriteria: string): string | null {
  const combined = `${description}\n${acceptanceCriteria}`;

  const labeledPatterns = [
    /(?:test|staging|env|environment|qa)\s*(?:url|link|site)?[:\s]+?(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi,
  ];

  for (const pattern of labeledPatterns) {
    const match = combined.match(pattern);
    if (match && match.length > 0) {
      const urls = extractUrls(match[0]);
      if (urls.length > 0) {
        return urls[0];
      }
    }
  }

  const allUrls = extractUrls(combined);
  return allUrls.length > 0 ? allUrls[0] : null;
}

/**
 * Extract authentication credentials from story content
 */
function extractAuthCredentials(description: string, acceptanceCriteria: string): {
  username: string | null;
  password: string | null;
} | null {
  const combined = `${description}\n${acceptanceCriteria}`;

  const pattern1 = /(?:username|user|email|login)[:\s]+([^\s,;]+)[\s,;]+(?:password|pass|pwd)[:\s]+([^\s,;]+)/gi;
  const match1 = pattern1.exec(combined);
  if (match1) {
    return {
      username: match1[1].trim(),
      password: match1[2].trim(),
    };
  }

  const pattern2 = /(?:credentials|login|auth)[:\s]+([^\s/]+)\s*\/\s*([^\s,;]+)/gi;
  const match2 = pattern2.exec(combined);
  if (match2) {
    return {
      username: match2[1].trim(),
      password: match2[2].trim(),
    };
  }

  const pattern3 = /(?:credentials|login|auth)[:\s]+([^\s:]+):([^\s,;]+)/gi;
  const match3 = pattern3.exec(combined);
  if (match3) {
    return {
      username: match3[1].trim(),
      password: match3[2].trim(),
    };
  }

  return null;
}

/**
 * Extract text from Atlassian Document Format (ADF)
 */
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

/**
 * Extract test scenarios from acceptance criteria
 */
function extractTestScenarios(acceptanceCriteria: string): string[] {
  if (!acceptanceCriteria || acceptanceCriteria.trim() === '') {
    return [];
  }

  const lines = acceptanceCriteria.split('\n');
  const scenarios: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const cleaned = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
      if (cleaned.length > 10) {
        scenarios.push(cleaned);
      }
    } else if (trimmed.length > 20 && !trimmed.endsWith(':')) {
      scenarios.push(trimmed);
    }
  }

  return scenarios;
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse request body
    const body: AnalysisRequest = await request.json();
    const { storyKey } = body;

    // Validate story key
    if (!storyKey || !validateJiraStoryKey(storyKey)) {
      return NextResponse.json(
        { error: "Invalid Jira story key" },
        { status: 400 }
      );
    }

    // Get Jira connection
    const jiraConnection = await getJiraConnection(userId);
    if (!jiraConnection) {
      return NextResponse.json(
        { error: "Jira connection required" },
        { status: 400 }
      );
    }

    if (!jiraConnection.activeCloudId) {
      return NextResponse.json(
        { error: "No active Jira site selected" },
        { status: 400 }
      );
    }

    // Fetch issue from Jira
    const accessToken = decryptToken(jiraConnection.accessTokenEncrypted || "");
    const issueUrl = `https://api.atlassian.com/ex/jira/${jiraConnection.activeCloudId}/rest/api/3/issue/${storyKey}`;

    const response = await makeAtlassianApiRequest(accessToken, issueUrl, {
      method: "GET",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: `Story ${storyKey} not found` },
          { status: 404 }
        );
      }
      throw new Error(`Jira API error: ${response.status}`);
    }

    const issue = await response.json();

    // Extract description (handle ADF format)
    let description = '';
    if (issue.fields?.description) {
      if (typeof issue.fields.description === 'string') {
        description = issue.fields.description;
      } else if (issue.fields.description.content) {
        description = extractTextFromADF(issue.fields.description);
      }
    }

    // Extract acceptance criteria from common custom fields
    let acceptanceCriteria = '';
    const acFields = ['customfield_10000', 'customfield_10100', 'customfield_10200'];
    for (const fieldId of acFields) {
      if (issue.fields?.[fieldId]) {
        const value = issue.fields[fieldId];
        if (typeof value === 'string') {
          acceptanceCriteria = value;
          break;
        } else if (value?.content) {
          acceptanceCriteria = extractTextFromADF(value);
          break;
        }
      }
    }

    // Extract environment URL
    const envUrl = extractEnvironmentUrl(description, acceptanceCriteria);

    // Extract auth credentials
    const auth = extractAuthCredentials(description, acceptanceCriteria);

    // Extract test scenarios
    const testScenarios = extractTestScenarios(acceptanceCriteria);

    const analysisResult: AnalysisResponse = {
      envUrl,
      auth,
      testScenarios,
      rawStory: {
        key: issue.key,
        summary: issue.fields?.summary || '',
        description,
        acceptanceCriteria,
      },
    };

    return NextResponse.json(analysisResult);
  } catch (error) {
    console.error("Story analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze story" },
      { status: 500 }
    );
  }
}
