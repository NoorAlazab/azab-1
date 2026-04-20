import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/auth/iron";
import { getJiraConnection } from "@/lib/server/db/mock";
import { getRecentStories, setRecentStories } from "@/lib/server/db/mock";
import { makeAtlassianApiRequest, decryptToken } from "@/lib/server/oauth/atlassian";

interface JiraSearchResponse {
  issues: Array<{
    id: string;
    key: string;
    fields: {
      summary: string;
      status: { name: string };
      updated: string;
      assignee?: { displayName: string };
      issuetype: { name: string };
      project: { key: string };
      priority?: { name: string };
      labels?: string[];
      customfield_10016?: number; // Story points
    };
  }>;
  total: number;
}

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const jql = searchParams.get("jql") || 
      "issuetype = Story ORDER BY updated DESC";
    const maxResults = Math.min(parseInt(searchParams.get("maxResults") || "20"), 50);

    // Get Jira connection
    const jiraConnection = await getJiraConnection(userId);
    
    if (!jiraConnection) {
      // Return mock data if not connected
      const mockStories = await getRecentStories(userId);
      return NextResponse.json({
        issues: mockStories.slice(0, maxResults).map(story => ({
          key: story.key,
          fields: {
            summary: story.summary,
            status: { name: story.status },
            updated: story.updated.toISOString(),
            assignee: story.assignee ? { displayName: story.assignee } : undefined,
            issuetype: { name: story.issueType },
            project: { key: story.project },
          },
        })),
        total: mockStories.length,
        mock: true,
      });
    }

    try {
      // Check for active cloudId
      if (!jiraConnection.activeCloudId) {
        return NextResponse.json(
          { error: "No active Jira site selected" },
          { status: 400 }
        );
      }

      // Make request to Jira
      const accessToken = decryptToken(jiraConnection.accessTokenEncrypted || "");
      const searchUrl = `https://api.atlassian.com/ex/jira/${jiraConnection.activeCloudId}/rest/api/3/search`;
      
      const response = await makeAtlassianApiRequest(accessToken, searchUrl, {
        method: "POST",
        body: JSON.stringify({
          jql,
          maxResults,
          fields: [
            "summary",
            "status", 
            "updated",
            "assignee",
            "issuetype",
            "project",
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Jira API error: ${response.status}`);
      }

      const data: JiraSearchResponse = await response.json();
      
      // Cache the stories
      const stories = data.issues.map(issue => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        updated: new Date(issue.fields.updated),
        assignee: issue.fields.assignee?.displayName,
        issueType: issue.fields.issuetype.name,
        project: issue.fields.project.key,
        priority: issue.fields.priority?.name || "Medium",
        storyPoints: issue.fields.customfield_10016 || 0,
        labels: issue.fields.labels || [],
      }));
      
      await setRecentStories(userId, stories);

      return NextResponse.json(data);
    } catch (jiraError) {
      console.error("Jira search error:", jiraError);
      
      // Fall back to cached/mock data
      const fallbackStories = await getRecentStories(userId);
      return NextResponse.json({
        issues: fallbackStories.slice(0, maxResults).map(story => ({
          key: story.key,
          fields: {
            summary: story.summary,
            status: { name: story.status },
            updated: story.updated.toISOString(),
            assignee: story.assignee ? { displayName: story.assignee } : undefined,
            issuetype: { name: story.issueType },
            project: { key: story.project },
          },
        })),
        total: fallbackStories.length,
        fallback: true,
        error: "Could not connect to Jira, showing cached data",
      });
    }
  } catch (error) {
    console.error("Jira search endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to search Jira issues" },
      { status: 500 }
    );
  }
}