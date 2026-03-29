import { fetchJiraIssue } from "@/lib/jira/fetch";
import type { SessionPayload } from "@/types/auth";
import { identifyPagesFromStory, extractPageKeywordsFromStory } from "./pageIdentifier";

export interface StoryAnalysisResult {
  envUrl: string | null;
  auth: {
    username: string | null;
    password: string | null;
  } | null;
  testScenarios: string[];
  requiredPages: string[]; // Pages needed for testing (normalized names)
  pageKeywords: string[]; // Raw keywords for journey-based discovery
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
    // Filter out obvious non-environment URLs
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
 * Looks for patterns like:
 * - "Test URL: https://..."
 * - "Environment: https://..."
 * - "Staging: https://..."
 */
function extractEnvironmentUrl(description: string, acceptanceCriteria: string): string | null {
  const combined = `${description}\n${acceptanceCriteria}`;

  // Try to find labeled URLs first
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

  // Fall back to any URL found
  const allUrls = extractUrls(combined);
  return allUrls.length > 0 ? allUrls[0] : null;
}

/**
 * Extract authentication credentials from story content
 * Looks for patterns like:
 * - "Username: test@example.com Password: test123"
 * - "Login: user / password"
 * - "Credentials: user:pass"
 */
function extractAuthCredentials(description: string, acceptanceCriteria: string): {
  username: string | null;
  password: string | null;
} | null {
  const combined = `${description}\n${acceptanceCriteria}`;

  // Pattern 1: Username: ... Password: ...
  const pattern1 = /(?:username|user|email|login)[:\s]+([^\s,;]+)[\s,;]+(?:password|pass|pwd)[:\s]+([^\s,;]+)/gi;
  const match1 = pattern1.exec(combined);
  if (match1) {
    return {
      username: match1[1].trim(),
      password: match1[2].trim(),
    };
  }

  // Pattern 2: Credentials: username / password
  const pattern2 = /(?:credentials|login|auth)[:\s]+([^\s/]+)\s*\/\s*([^\s,;]+)/gi;
  const match2 = pattern2.exec(combined);
  if (match2) {
    return {
      username: match2[1].trim(),
      password: match2[2].trim(),
    };
  }

  // Pattern 3: username:password format
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
 * Extract test scenarios from acceptance criteria
 * Splits on common bullet point patterns
 */
function extractTestScenarios(acceptanceCriteria: string): string[] {
  if (!acceptanceCriteria || acceptanceCriteria.trim() === '') {
    return [];
  }

  // Split by common bullet patterns: -, *, numbers
  const lines = acceptanceCriteria.split('\n');
  const scenarios: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match bullet points or numbered lists
    if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const cleaned = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
      if (cleaned.length > 10) { // Ignore very short items
        scenarios.push(cleaned);
      }
    } else if (trimmed.length > 20 && !trimmed.endsWith(':')) {
      // Include substantial standalone lines that aren't headers
      scenarios.push(trimmed);
    }
  }

  return scenarios;
}

/**
 * Analyze a Jira story and extract exploration-relevant information
 */
export async function analyzeJiraStory(
  session: SessionPayload,
  storyKey: string
): Promise<StoryAnalysisResult> {
  // Fetch the full Jira story
  const issue = await fetchJiraIssue(session, storyKey);

  // Extract fields
  const description = typeof issue.fields?.description === 'string'
    ? issue.fields.description
    : JSON.stringify(issue.fields?.description || '');

  const acceptanceCriteria = issue.fields?.customfield_10000 ||
                             issue.fields?.acceptance_criteria ||
                             '';

  // Extract environment URL
  const envUrl = extractEnvironmentUrl(description, acceptanceCriteria);

  // Extract auth credentials
  const auth = extractAuthCredentials(description, acceptanceCriteria);

  // Extract test scenarios
  const testScenarios = extractTestScenarios(acceptanceCriteria);

  // Identify required pages for selector recording
  const requiredPages = identifyPagesFromStory(
    issue.fields?.summary || '',
    description,
    acceptanceCriteria,
    testScenarios
  );

  // Extract raw keywords for journey-based discovery
  const pageKeywords = extractPageKeywordsFromStory(
    issue.fields?.summary || '',
    description,
    acceptanceCriteria,
    testScenarios
  );

  return {
    envUrl,
    auth,
    testScenarios,
    requiredPages,
    pageKeywords,
    rawStory: {
      key: issue.key,
      summary: issue.fields?.summary || '',
      description,
      acceptanceCriteria,
    },
  };
}
