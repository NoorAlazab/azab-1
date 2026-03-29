import { NextRequest, NextResponse } from "next/server";
import { parseIssueKey } from "@/lib/jira/issueKey";
import { asText } from "@/lib/jira/adf";
import { assertValidCsrf } from "@/lib/security/csrf";
import { requireUserId } from "@/lib/auth/iron";
import { getFreshAccessTokenForUser } from "@/lib/jira/tokenService";

export const runtime = "nodejs";

interface ResolveIssueRequest {
  issueKey?: string;
  issueLink?: string;
}

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description?: any;
    project: {
      key: string;
      name: string;
    };
    status: {
      name: string;
    };
    assignee?: {
      displayName: string;
    };
    priority?: {
      name: string;
    };
    [key: string]: any; // For custom fields
  };
}

interface ResolvedIssue {
  ok: true;
  siteName: string;
  siteId: string;
  issue: {
    key: string;
    url: string;
    project: {
      key: string;
      name: string;
    };
    status: string;
    assignee: string | null;
    priority: string | null;
    summary: string;
    descriptionText: string;
    acceptanceCriteriaText?: string;
  };
}

interface ErrorResponse {
  ok: false;
  code: string;
  message: string;
  detail?: any;
}

export async function POST(request: NextRequest) {
  try {
    assertValidCsrf();
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Invalid CSRF token" }), { status: e.status ?? 403, headers: { "content-type": "application/json" } });
  }

  try {
    // Require authentication
    const userId = await requireUserId();
    const body: ResolveIssueRequest = await request.json();

    // Extract issue key from input
    let issueKey = body.issueKey?.trim();
    if (!issueKey && body.issueLink) {
      const parsed = parseIssueKey(body.issueLink);
      issueKey = parsed || undefined;
    }

    // Validate issue key format
    if (!issueKey || !/^[A-Z][A-Z0-9]+-\d+$/.test(issueKey)) {
      return NextResponse.json({
        ok: false,
        code: "INVALID_KEY",
        message: "Invalid issue key format. Expected format: PROJ-123"
      } as ErrorResponse, { status: 400 });
    }

    // Get fresh access token using new token service
    const fresh = await getFreshAccessTokenForUser(userId);
    if (!fresh) {
      return NextResponse.json({
        ok: false,
        code: "UNAUTHORIZED",
        message: "Reconnect Jira"
      } as ErrorResponse, { status: 401 });
    }

    const { accessToken, cloudId } = fresh;

    // Build fields list
    const fields = ['summary', 'description', 'project', 'status', 'assignee', 'priority'];
    if (process.env.JIRA_AC_FIELD_ID) {
      fields.push(process.env.JIRA_AC_FIELD_ID);
    }

    // Fetch issue from Jira
    const jiraUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}?fields=${fields.join(',')}`;
    
    const jiraResponse = await fetch(jiraUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    // Handle Jira API errors
    if (!jiraResponse.ok) {
      const status = jiraResponse.status;
      
      if (status === 401) {
        return NextResponse.json({
          ok: false,
          code: "UNAUTHORIZED",
          message: "Session expired. Reconnect Jira."
        } as ErrorResponse, { status: 401 });
      }
      
      if (status === 403) {
        return NextResponse.json({
          ok: false,
          code: "FORBIDDEN",
          message: "Missing 'Browse projects' permission for this project."
        } as ErrorResponse, { status: 403 });
      }
      
      if (status === 404) {
        let body;
        try {
          body = await jiraResponse.json();
        } catch {
          // If JSON parsing fails, continue with empty body
        }
        
        return NextResponse.json({
          ok: false,
          code: "NOT_FOUND",
          message: `Issue ${issueKey} not found on active site. Check site or key.`,
          detail: body?.errorMessages ?? body
        }, { status: 404 });
      }
      
      let errorText;
      try {
        errorText = await jiraResponse.text();
      } catch {
        errorText = 'Unknown error';
      }
      
      return NextResponse.json({
        ok: false,
        code: "JIRA_ERROR",
        message: `Jira error ${status}`,
        detail: errorText
      } as ErrorResponse, { status: 500 });
    }

    const jiraIssue: JiraIssue = await jiraResponse.json();

    // Convert fields to text
    const descriptionText = asText(jiraIssue.fields.description);
    const acceptanceCriteriaText = process.env.JIRA_AC_FIELD_ID 
      ? asText(jiraIssue.fields[process.env.JIRA_AC_FIELD_ID])
      : undefined;
    
    console.log('JIRA_AC_FIELD_ID:', process.env.JIRA_AC_FIELD_ID);
    console.log('Acceptance criteria found:', !!acceptanceCriteriaText);
    console.log('Available fields:', Object.keys(jiraIssue.fields));

    // Build response
    const resolvedIssue: ResolvedIssue = {
      ok: true,
      siteName: "Jira Site", // TODO: Get from site info if needed
      siteId: cloudId,
      issue: {
        key: jiraIssue.key,
        url: `https://jira.atlassian.com/browse/${jiraIssue.key}`, // Generic URL
        project: {
          key: jiraIssue.fields.project.key,
          name: jiraIssue.fields.project.name,
        },
        status: jiraIssue.fields.status.name,
        assignee: jiraIssue.fields.assignee?.displayName || null,
        priority: jiraIssue.fields.priority?.name || null,
        summary: jiraIssue.fields.summary,
        descriptionText,
        acceptanceCriteriaText,
      },
    };

    return NextResponse.json(resolvedIssue);

  } catch (error) {
    console.error("Issue resolve error:", error);
    return NextResponse.json({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Failed to resolve issue"
    } as ErrorResponse, { status: 500 });
  }
}