import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/auth/iron";
import { decryptToken } from "@/lib/server/oauth/atlassian";
import { assertValidCsrf } from "@/lib/server/security/csrf";
import { getJiraConnection } from "@/lib/server/db/mock";

export const runtime = "nodejs";

interface LocateIssueRequest {
  issueKey: string;
}

interface LocateFoundResponse {
  ok: true;
  found: true;
  site: {
    id: string;
    name: string;
    url: string;
  };
}

interface LocateNotFoundResponse {
  ok: true;
  found: false;
}

interface ErrorResponse {
  ok: false;
  code: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    assertValidCsrf();
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Invalid CSRF token" }), { status: e.status ?? 403, headers: { "content-type": "application/json" } });
  }

  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const body: LocateIssueRequest = await request.json();

    // Validate issue key format
    const issueKey = body.issueKey?.trim();
    if (!issueKey || !/^[A-Z][A-Z0-9]+-\d+$/.test(issueKey)) {
      return NextResponse.json({
        ok: false,
        code: "INVALID_KEY",
        message: "Invalid issue key format. Expected format: PROJ-123"
      } as ErrorResponse, { status: 400 });
    }

    // Check if user has Jira connection
    const jiraConnection = await getJiraConnection(userId);
    if (!jiraConnection?.accessTokenEncrypted || !jiraConnection?.sites) {
      return NextResponse.json({
        ok: false,
        code: "NO_JIRA_CONNECTION",
        message: "No Jira connection found. Please connect your Jira account first."
      } as ErrorResponse, { status: 400 });
    }

    // Decrypt access token
    const accessToken = decryptToken(jiraConnection.accessTokenEncrypted);

    // Search each site for the issue
    for (const site of jiraConnection.sites) {
      try {
        const jiraUrl = `https://api.atlassian.com/ex/jira/${site.id}/rest/api/3/issue/${issueKey}`;
        
        // Use HEAD for fast check first
        const headResponse = await fetch(jiraUrl, {
          method: 'HEAD',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        // If HEAD succeeds (200), the issue exists on this site
        if (headResponse.ok) {
          return NextResponse.json({
            ok: true,
            found: true,
            site: {
              id: site.id,
              name: site.name,
              url: site.url
            }
          } as LocateFoundResponse);
        }

        // If HEAD fails with anything other than 404, try GET for more info
        if (headResponse.status !== 404) {
          const getResponse = await fetch(jiraUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });

          if (getResponse.ok) {
            return NextResponse.json({
              ok: true,
              found: true,
              site: {
                id: site.id,
                name: site.name,
                url: site.url
              }
            } as LocateFoundResponse);
          }
        }

        // Continue to next site if 404 or other errors
        continue;

      } catch (error) {
        // Network error or other issues - continue to next site
        console.warn(`Failed to check site ${site.name} for issue ${issueKey}:`, error);
        continue;
      }
    }

    // Issue not found on any site
    return NextResponse.json({
      ok: true,
      found: false
    } as LocateNotFoundResponse);

  } catch (error) {
    console.error("Issue locate error:", error);
    return NextResponse.json({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Failed to locate issue"
    } as ErrorResponse, { status: 500 });
  }
}