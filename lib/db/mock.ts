import { AppUser, SessionPayload, JiraConnection, JiraConnectionLegacy, MagicLinkToken } from "@/types/auth";

/**
 * Hybrid storage layer.
 *
 * Persistence-critical bits (Checklist, ActivityEvent, PkceSession) are
 * Prisma-backed via lib/db/checklist.ts, lib/db/activity.ts, and
 * lib/db/pkce.ts respectively, and re-exported below for back-compat.
 *
 * The remaining in-memory maps (sessions, magic links, JiraConnection
 * snapshot, recent stories cache) are scratch state we intentionally do
 * not persist:
 *   - sessions: superseded by iron-session cookies for real sessions.
 *   - magicLinkTokens: short-lived; will move to Prisma when magic-link
 *     login is re-enabled.
 *   - jiraConnections: snapshot of the active site list is also persisted
 *     in the JiraConnection / JiraToken Prisma models; this map is just a
 *     fast cache for the dashboard.
 */

const users = new Map<string, AppUser>(); // email -> user
const usersByEmail = new Map<string, string>(); // email -> userId (for lookups)
const sessions = new Map<string, SessionPayload>(); // sessionId -> session
const magicLinkTokens = new Map<string, MagicLinkToken>(); // token -> magicLink
const jiraConnections = new Map<string, JiraConnection>(); // userId -> jiraConnection

// User operations
export async function createUser(email: string): Promise<AppUser> {
  const existingUserId = usersByEmail.get(email);
  if (existingUserId) {
    const existingUser = users.get(existingUserId);
    if (existingUser) {
      return existingUser;
    }
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  
  const user: AppUser = {
    id: userId,
    email,
    createdAt: now,
    updatedAt: now,
  };

  users.set(userId, user);
  usersByEmail.set(email, userId);
  
  return user;
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const userId = usersByEmail.get(email);
  if (!userId) return null;
  
  return users.get(userId) || null;
}

export async function getUserById(userId: string): Promise<AppUser | null> {
  return users.get(userId) || null;
}

// Session operations
export async function createSession(sessionId: string, payload: SessionPayload): Promise<void> {
  sessions.set(sessionId, payload);
}

export async function getSession(sessionId: string): Promise<SessionPayload | null> {
  const session = sessions.get(sessionId);
  
  // Check if session is expired
  if (session && session.expiresAt < new Date()) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session || null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  sessions.delete(sessionId);
}

// Magic link operations
export async function createMagicLinkToken(token: string, email: string, expiresAt: Date): Promise<void> {
  const magicLink: MagicLinkToken = {
    token,
    email,
    expiresAt,
    used: false,
  };
  
  magicLinkTokens.set(token, magicLink);
}

export async function getMagicLinkToken(token: string): Promise<MagicLinkToken | null> {
  const magicLink = magicLinkTokens.get(token);
  
  if (!magicLink) return null;
  
  // Check if token is expired
  if (magicLink.expiresAt < new Date()) {
    magicLinkTokens.delete(token);
    return null;
  }
  
  return magicLink;
}

export async function useMagicLinkToken(token: string): Promise<boolean> {
  const magicLink = magicLinkTokens.get(token);
  
  if (!magicLink || magicLink.used || magicLink.expiresAt < new Date()) {
    return false;
  }
  
  magicLink.used = true;
  magicLinkTokens.set(token, magicLink);
  
  // Delete token after use
  setTimeout(() => {
    magicLinkTokens.delete(token);
  }, 1000);
  
  return true;
}

// Jira connection operations (updated for multi-site support)
export async function saveJiraConnection(connection: JiraConnection | JiraConnectionLegacy): Promise<void> {
  // Handle legacy format by converting to new format
  if ('userId' in connection && 'cloudId' in connection && typeof connection.cloudId === 'string') {
    const legacy = connection as JiraConnectionLegacy;
    const newConnection: JiraConnection = {
      connected: true,
      activeCloudId: legacy.cloudId,
      activeSiteName: legacy.siteName,
      sites: [{
        id: legacy.cloudId,
        name: legacy.siteName,
        url: `https://${legacy.siteName.toLowerCase().replace(/\s+/g, '')}.atlassian.net`,
        scopes: legacy.scopes,
      }],
      scopes: legacy.scopes,
      accessTokenEncrypted: legacy.accessTokenEncrypted,
      refreshTokenEncrypted: legacy.refreshTokenEncrypted,
      expiresAt: legacy.expiresAt,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
    };
    jiraConnections.set(legacy.userId, newConnection);
  } else {
    // Handle new format - assume userId is available in context
    const newConnection = connection as JiraConnection;
    // For now, we'll need userId from somewhere else or make it part of the function signature
    console.warn('New JiraConnection format requires userId context');
  }
}

export async function saveJiraConnectionForUser(userId: string, connection: JiraConnection): Promise<void> {
  jiraConnections.set(userId, connection);
}

export async function getJiraConnection(userId: string): Promise<JiraConnection | null> {
  const connection = jiraConnections.get(userId);
  if (!connection) return null;

  // If it's legacy format, return as-is for backward compatibility
  return connection;
}

export async function deleteJiraConnection(userId: string): Promise<void> {
  jiraConnections.delete(userId);
}

export async function updateActiveJiraSite(userId: string, cloudId: string): Promise<boolean> {
  const connection = jiraConnections.get(userId);
  if (!connection || !connection.sites) return false;

  const site = connection.sites.find(s => s.id === cloudId);
  if (!site) return false;

  connection.activeCloudId = cloudId;
  connection.activeSiteName = site.name;
  connection.updatedAt = new Date();
  
  jiraConnections.set(userId, connection);
  return true;
}

// PKCE operations now live in lib/db/pkce.ts (Prisma-backed). Re-exported
// from this module for backward compatibility with existing callers.
export {
  savePKCESession,
  getPKCESession,
  deletePKCESession,
} from "@/lib/db/pkce";

// Checklist + ActivityEvent now live in dedicated Prisma-backed modules
// (lib/db/checklist.ts and lib/db/activity.ts). Re-exported here so the
// many existing call sites do not need to change their import paths in a
// single sweep.
export {
  getChecklist,
  updateChecklistItem,
  type ChecklistItemKey,
  type ChecklistView,
} from "@/lib/db/checklist";
export {
  getActivity,
  addActivityEvent,
  initializeDemoActivity,
  type ActivityEventView,
  type ActivityEventType,
  type ActivityEventStatus,
} from "@/lib/db/activity";

interface JiraStory {
  id: string;
  key: string;
  summary: string;
  status: string;
  updated: Date;
  assignee?: string;
  priority?: string;
  storyPoints?: number;
  labels?: string[];
  issueType: string;
  project: string;
}

// Recent-stories cache is still in-memory: it is populated from live Jira
// search results and is fine to lose on restart (the dashboard re-fetches
// when the cache is empty).
const recentStoriesByUserId = new Map<string, JiraStory[]>();

// Initialize demo activity for new users (delegates to the Prisma-backed
// activity module). Kept under the legacy `initializeDemoData` name so that
// existing callers keep compiling.
export async function initializeDemoData(userId: string): Promise<void> {
  const { initializeDemoActivity } = await import("@/lib/db/activity");
  await initializeDemoActivity(userId);
}

// Jira stories operations
export async function getRecentStories(userId: string): Promise<JiraStory[]> {
  const stored = recentStoriesByUserId.get(userId);
  if (stored) {
    return stored;
  }
  
  // Return mock data if no real stories
  const mockStories: JiraStory[] = [
    {
      id: "story-123",
      key: "DEMO-123",
      summary: "As a user, I want to login with magic links",
      status: "In Progress",
      updated: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      assignee: "John Doe",
      priority: "High",
      storyPoints: 5,
      labels: ["authentication", "security"],
      issueType: "Story",
      project: "DEMO",
    },
    {
      id: "story-124",
      key: "DEMO-124",
      summary: "As a QA engineer, I want to generate test cases from user stories",
      status: "To Do",
      updated: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      assignee: "Jane Smith",
      priority: "Medium",
      storyPoints: 8,
      labels: ["testing", "automation"],
      issueType: "Story",
      project: "DEMO",
    },
    {
      id: "story-125",
      key: "DEMO-125",
      summary: "As a developer, I want to integrate with Jira OAuth securely",
      status: "Done",
      updated: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      assignee: "Mike Johnson",
      priority: "High",
      storyPoints: 3,
      labels: ["integration", "oauth"],
      issueType: "Story", 
      project: "DEMO",
    },
    {
      id: "story-126",
      key: "DEMO-126",
      summary: "As a user, I want to see my recent test generation activity",
      status: "In Review",
      updated: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      assignee: "Demo User",
      priority: "Low",
      storyPoints: 2,
      labels: ["dashboard", "ui"],
      issueType: "Story",
      project: "DEMO",
    },
    {
      id: "story-127",
      key: "DEMO-127",
      summary: "As a team lead, I want to track test case coverage per epic",
      status: "To Do", 
      updated: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      assignee: "Sarah Wilson",
      priority: "Medium",
      storyPoints: 5,
      labels: ["reporting", "metrics"],
      issueType: "Story",
      project: "DEMO",
    },
  ];
  
  recentStoriesByUserId.set(userId, mockStories);
  return mockStories;
}

export async function setRecentStories(userId: string, stories: JiraStory[]): Promise<void> {
  recentStoriesByUserId.set(userId, stories);
}

// Background cleanup for the still-in-memory stores (sessions, magic links).
// PKCE expiry now happens lazily inside lib/db/pkce.ts (and via the index
// on PkceSession.expiresAt for callers that explicitly prune).
setInterval(() => {
  const now = new Date();

  sessions.forEach((session, sessionId) => {
    if (session.expiresAt < now) sessions.delete(sessionId);
  });

  magicLinkTokens.forEach((magicLink, token) => {
    if (magicLink.expiresAt < now) magicLinkTokens.delete(token);
  });
}, 60 * 1000);