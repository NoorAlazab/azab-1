import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/iron";
import { getJiraConnection } from "@/lib/db/mock";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    let jiraConnection = null;
    
    if (session.userId) {
      try {
        jiraConnection = await getJiraConnection(session.userId);
      } catch {
        // If getJiraConnection fails, just continue without it
      }
    }
    
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      auth: {
        authenticated: !!session.userId,
        userId: session.userId || null,
        hasJiraConnection: !!(jiraConnection && jiraConnection.connected),
        activeCloudId: jiraConnection?.activeCloudId || null,
        sitesCount: jiraConnection?.sites?.length || 0,
        sites: jiraConnection?.sites?.map(site => ({
          id: site.id,
          name: site.name,
          url: site.url
        })) || []
      },
      endpoints: {
        resolve: "/api/jira/issue/resolve",
        locate: "/api/jira/issue/locate",
        draft: "/api/generator/draft",
        publish: "/api/jira/publish"
      }
    };

    return NextResponse.json(health);

  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}