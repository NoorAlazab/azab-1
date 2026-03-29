import { AppUser, SessionPayload, JiraConnection, JiraConnectionLegacy, MagicLinkToken, PKCESession } from "@/types/auth";

/**
 * Temporary in-memory storage - replace with real database later
 */

// In-memory stores
const users = new Map<string, AppUser>(); // email -> user
const usersByEmail = new Map<string, string>(); // email -> userId (for lookups)
const sessions = new Map<string, SessionPayload>(); // sessionId -> session
const magicLinkTokens = new Map<string, MagicLinkToken>(); // token -> magicLink
const jiraConnections = new Map<string, JiraConnection>(); // userId -> jiraConnection
const pkceStore = new Map<string, PKCESession>(); // nonce -> pkceSession

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

// PKCE operations
export async function savePKCESession(nonce: string, session: PKCESession): Promise<void> {
  pkceStore.set(nonce, session);
}

export async function getPKCESession(nonce: string): Promise<PKCESession | null> {
  const session = pkceStore.get(nonce);
  
  if (!session) return null;
  
  // Check if session is expired
  if (session.expiresAt < new Date()) {
    pkceStore.delete(nonce);
    return null;
  }
  
  return session;
}

export async function deletePKCESession(nonce: string): Promise<void> {
  pkceStore.delete(nonce);
}

// New types for dashboard features
interface ChecklistItem {
  connectJira: boolean;
  configureLLM: boolean;
  chooseStorageMode: boolean;
  firstSuite: boolean;
}

interface ActivityEvent {
  id: string;
  type: "generation" | "writeback" | "connection" | "error";
  title: string;
  description?: string;
  status: "success" | "pending" | "error";
  timestamp: Date;
  metadata?: Record<string, any>;
}

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

// Additional stores
const checklistByUserId = new Map<string, ChecklistItem>();
const activityByUserId = new Map<string, ActivityEvent[]>();
const recentStoriesByUserId = new Map<string, JiraStory[]>();

// Checklist operations
export async function getChecklist(userId: string): Promise<ChecklistItem> {
  return checklistByUserId.get(userId) || {
    connectJira: false,
    configureLLM: false,
    chooseStorageMode: false,
    firstSuite: false,
  };
}

export async function updateChecklistItem(
  userId: string,
  item: keyof ChecklistItem,
  value: boolean
): Promise<void> {
  const current = await getChecklist(userId);
  const updated = { ...current, [item]: value };
  checklistByUserId.set(userId, updated);
  
  // Add activity event for checklist updates
  if (value) {
    await addActivityEvent(userId, {
      type: "generation",
      title: `Completed: ${getChecklistItemTitle(item)}`,
      status: "success",
    });
  }
}

function getChecklistItemTitle(item: keyof ChecklistItem): string {
  const titles = {
    connectJira: "Connect Jira",
    configureLLM: "Configure LLM",
    chooseStorageMode: "Choose Test Storage Mode",
    firstSuite: "Generate Your First Suite",
  };
  return titles[item];
}

// Activity operations
export async function getActivity(
  userId: string, 
  options?: { limit?: number; offset?: number }
): Promise<ActivityEvent[]> {
  const allActivity = activityByUserId.get(userId) || [];
  
  if (!options) return allActivity;
  
  const { limit = 10, offset = 0 } = options;
  return allActivity.slice(offset, offset + limit);
}

export async function addActivityEvent(userId: string, event: Omit<ActivityEvent, "id" | "timestamp">): Promise<void> {
  const activity = await getActivity(userId);
  const newEvent: ActivityEvent = {
    ...event,
    id: `${event.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  };
  
  // Add to beginning and keep only last 50 events
  activity.unshift(newEvent);
  if (activity.length > 50) {
    activity.splice(50);
  }
  
  activityByUserId.set(userId, activity);
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

// Initialize demo activity for new users
export async function initializeDemoData(userId: string): Promise<void> {
  // Add some sample activity events
  const demoEvents: Omit<ActivityEvent, "id" | "timestamp">[] = [
    {
      type: "connection",
      title: "Connected to Jira",
      description: "Successfully connected to Demo Company Jira",
      status: "success",
    },
    {
      type: "generation",
      title: "Generated test cases for DEMO-123",
      description: "Created 8 test cases for magic link authentication",
      status: "success",
    },
    {
      type: "writeback",
      title: "Synced test cases to Jira",
      description: "Added test cases as comments to DEMO-123",
      status: "success",
    },
  ];
  
  for (const event of demoEvents) {
    await addActivityEvent(userId, event);
  }
}

// Cleanup expired items periodically
setInterval(() => {
  const now = new Date();
  
  // Clean up expired sessions
  sessions.forEach((session, sessionId) => {
    if (session.expiresAt < now) {
      sessions.delete(sessionId);
    }
  });
  
  // Clean up expired magic link tokens
  magicLinkTokens.forEach((magicLink, token) => {
    if (magicLink.expiresAt < now) {
      magicLinkTokens.delete(token);
    }
  });
  
  // Clean up expired PKCE sessions
  pkceStore.forEach((session, nonce) => {
    if (session.expiresAt < now) {
      pkceStore.delete(nonce);
    }
  });
}, 60 * 1000); // Run cleanup every minute