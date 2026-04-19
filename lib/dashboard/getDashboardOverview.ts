import { prisma } from "@/lib/db/prisma";
import {
  getJiraConnection,
  getChecklist,
  getActivity,
  getRecentStories,
  initializeDemoData,
  updateChecklistItem,
} from "@/lib/db/mock";

/**
 * Single source of truth for the dashboard overview payload.
 *
 * Originally this lived inline inside `app/api/dashboard/overview/route.ts`,
 * but the dashboard page is now an RSC that needs the same data on the
 * server side without making an internal HTTP call back to itself. Both
 * the API route and the RSC import this function — one shape, one set of
 * side effects (demo-data seeding + checklist auto-update).
 *
 * The shape is intentionally serializable (Date objects converted to ISO
 * strings) so the RSC can pass it directly to the client component as a
 * prop without React serialization complaints.
 */

export interface DashboardOverview {
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

export class DashboardUserNotFoundError extends Error {
  constructor() {
    super("User not found");
    this.name = "DashboardUserNotFoundError";
  }
}

export async function getDashboardOverview(userId: string): Promise<DashboardOverview> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) throw new DashboardUserNotFoundError();

  const jiraConnection = await getJiraConnection(userId);

  // Seed demo data the first time a user lands on the dashboard so the
  // empty state isn't completely barren. This is a no-op for returning
  // users (activity is non-empty).
  const activity = await getActivity(userId);
  if (activity.length === 0) {
    await initializeDemoData(userId);
  }

  const checklist = await getChecklist(userId);

  // If Jira is connected but the checklist hasn't caught up yet, mark it
  // done. Cheaper here (single conditional write) than running a full
  // background reconciliation job.
  if (jiraConnection && !checklist.connectJira) {
    await updateChecklistItem(userId, "connectJira", true);
  }

  const recentStories = await getRecentStories(userId);
  const recentActivity = await getActivity(userId);
  const finalChecklist = await getChecklist(userId);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name || user.email.split("@")[0],
    },
    jiraConnection: {
      isConnected: !!jiraConnection && jiraConnection.connected,
      siteName: jiraConnection?.activeSiteName || undefined,
      cloudId: jiraConnection?.activeCloudId || undefined,
      scopes: jiraConnection?.scopes,
      expiresAt: jiraConnection?.expiresAt?.toISOString(),
    },
    checklist: finalChecklist,
    recentStories: recentStories.slice(0, 5).map((story) => ({
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
    recentActivity: recentActivity.slice(0, 10).map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      status: event.status,
      timestamp: event.timestamp.toISOString(),
    })),
  };
}
