import { NextRequest, NextResponse } from "next/server";
import { parseIssueKey } from "@/lib/jira/issueKey";
import { JiraError } from "@/lib/jira/errors";
import { getJiraIssueDB } from "@/lib/jira/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { issueKey: providedKey, issueLink } = body;
    
    // Determine the final issue key
    let issueKey = providedKey;
    
    // If no issue key provided but we have a link, try to parse it
    if (!issueKey && issueLink) {
      issueKey = parseIssueKey(issueLink);
    }
    
    // Validate the issue key format
    if (!issueKey) {
      return NextResponse.json(
        { error: "Valid issue key or link is required", code: "BAD_KEY" },
        { status: 400 }
      );
    }
    
    const issueKeyRegex = /^[A-Z][A-Z0-9]+-\d+$/i;
    if (!issueKeyRegex.test(issueKey)) {
      return NextResponse.json(
        { error: "Invalid issue key format", code: "BAD_KEY" },
        { status: 400 }
      );
    }
    
    // Fetch issue from Jira (database-backed auth) to validate that it
    // exists and surface basic info to the caller.
    const issueRaw = await getJiraIssueDB(issueKey);
    return NextResponse.json({
      key: issueRaw.key,
      summary: issueRaw.fields?.summary ?? "",
      description: issueRaw.fields?.description ?? "",
      status: issueRaw.fields?.status?.name ?? "Unknown",
      projectKey: String(issueRaw.key).split("-")[0],
      valid: true,
    });
    
  } catch (error) {
    console.error("Issue probe error:", error);
    
    if (error instanceof JiraError) {
      // Map Jira errors to appropriate response codes
      let code = "UNKNOWN";
      if (error.jiraError.status === 401) code = "JIRA_UNAUTHORIZED";
      else if (error.jiraError.status === 403) code = "JIRA_FORBIDDEN";
      else if (error.jiraError.status === 404) code = "JIRA_NOT_FOUND";
      else if (error.jiraError.status === 429) code = "JIRA_RATE_LIMIT";
      
      return NextResponse.json(
        { error: error.jiraError.message, code },
        { status: error.jiraError.status }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to probe issue", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}