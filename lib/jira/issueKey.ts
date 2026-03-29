/**
 * Parses a Jira issue key from either a URL or plain text
 */
export function parseIssueKey(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Regex to match Jira issue key pattern (e.g., PROJ-123, ABC-456)
  const issueKeyRegex = /([A-Z][A-Z0-9]+-\d+)/i;
  
  // If it looks like a URL, extract the issue key from it
  if (trimmed.includes('atlassian.net') || trimmed.startsWith('http')) {
    const match = trimmed.match(issueKeyRegex);
    return match ? match[1].toUpperCase() : null;
  }
  
  // If it's plain text, check if it matches the issue key pattern
  const match = trimmed.match(issueKeyRegex);
  if (match && match[0] === trimmed.toUpperCase()) {
    return trimmed.toUpperCase();
  }
  
  return null;
}