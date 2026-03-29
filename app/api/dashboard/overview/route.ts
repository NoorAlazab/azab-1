import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { getJiraConnection } from "@/lib/db/mock";
import { 
  getChecklist, 
  getActivity, 
  getRecentStories,
  initializeDemoData 
} from "@/lib/db/mock";
import { prisma } from "@/lib/db/prisma";

interface DashboardOverview {
  user: {
    id: string;
    email: string;
    name: string;
  };
  jiraConnection: {
    isConnected: boolean;
    siteName?: string;
    cloudId?: string;
    scopes?: string[];
    expiresAt?: string;
  };
  checklist: {
    connectJira: boolean;
    configureLLM: boolean;
    chooseStorageMode: boolean;
    firstSuite: boolean;
  };
  recentStories: Array<{
    id: string;
    key: string;
    summary: string;
    status: string;
    updated: string;
    assignee?: string;
    priority?: string;
    storyPoints?: number;
    labels?: string[];
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    status: string;
    timestamp: string;
  }>;
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

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get Jira connection
    const jiraConnection = await getJiraConnection(userId);

    // Initialize demo data if this is a new user
    const activity = await getActivity(userId);
    if (activity.length === 0) {
      await initializeDemoData(userId);
    }

    // Get checklist state
    const checklist = await getChecklist(userId);

    // Auto-mark Jira connection if connected
    if (jiraConnection && !checklist.connectJira) {
      const { updateChecklistItem } = await import("@/lib/db/mock");
      await updateChecklistItem(userId, "connectJira", true);
    }

    // Get recent stories and activity
    const recentStories = await getRecentStories(userId);
    const recentActivity = await getActivity(userId);

    const overview: DashboardOverview = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
      },
      jiraConnection: {
        isConnected: !!jiraConnection && jiraConnection.connected,
        siteName: jiraConnection?.activeSiteName || undefined,
        cloudId: jiraConnection?.activeCloudId || undefined,
        scopes: jiraConnection?.scopes,
        expiresAt: jiraConnection?.expiresAt?.toISOString(),
      },
      checklist: await getChecklist(userId),
      recentStories: recentStories.slice(0, 5).map(story => ({
        id: story.id,
        key: story.key,
        summary: story.summary,
        status: story.status,
        updated: story.updated.toISOString(),
        assignee: story.assignee,
        priority: story.priority,
        storyPoints: story.storyPoints,
        labels: story.labels,
      })),
      recentActivity: recentActivity.slice(0, 10).map(event => ({
        id: event.id,
        type: event.type,
        title: event.title,
        description: event.description,
        status: event.status,
        timestamp: event.timestamp.toISOString(),
      })),
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Dashboard overview error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}