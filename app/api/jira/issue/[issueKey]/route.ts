import { NextRequest, NextResponse } from "next/server";
import { JiraError } from "@/lib/server/jira/errors";
import { getJiraIssueDB } from "@/lib/server/jira/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { issueKey: string } }
) {
  try {
    const { issueKey } = params;
    
    if (!issueKey) {
      return NextResponse.json(
        { error: "Issue key is required" },
        { status: 400 }
      );
    }
    
    // Use database-based auth with token decryption fix
    console.log(' [API] Using database-based auth for issue:', issueKey);
    const issue = await getJiraIssueDB(issueKey);
    console.log(' [API] Successfully fetched issue using DB auth');
    
    return NextResponse.json(issue);
    
  } catch (error) {
    console.error("Issue fetch error:", error);
    
    if (error instanceof JiraError) {
      return NextResponse.json(
        { error: error.message, jiraError: error.jiraError },
        { status: error.jiraError.status }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch issue" },
      { status: 500 }
    );
  }
}
