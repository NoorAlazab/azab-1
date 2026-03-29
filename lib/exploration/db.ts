import { ExplorationRun, ExplorationFile, EphemeralUserRef, Bug } from "./types";

// In-memory storage for exploration data
const runsByUserId = new Map<string, ExplorationRun[]>();
const filesByUserId = new Map<string, ExplorationFile[]>();
const ephemeralUsersByUserId = new Map<string, EphemeralUserRef[]>();
const storageStatesByRunId = new Map<string, { storageStateId: string; createdAt: string }>();
const lastUsedEnvUrlByUserId = new Map<string, string>();
const bugsByRunId = new Map<string, Bug[]>();

// File operations
export async function addFile(userId: string, file: ExplorationFile): Promise<void> {
  const userFiles = filesByUserId.get(userId) || [];
  userFiles.push(file);
  filesByUserId.set(userId, userFiles);
}

export async function getFile(userId: string, fileId: string): Promise<ExplorationFile | null> {
  const userFiles = filesByUserId.get(userId) || [];
  return userFiles.find(f => f.fileId === fileId) || null;
}

export async function listFiles(userId: string): Promise<ExplorationFile[]> {
  return filesByUserId.get(userId) || [];
}

// Run operations
export async function createRun(run: ExplorationRun): Promise<void> {
  const userRuns = runsByUserId.get(run.userId) || [];
  userRuns.unshift(run); // Add to beginning (newest first)
  runsByUserId.set(run.userId, userRuns);
}

export async function listRuns(userId: string): Promise<ExplorationRun[]> {
  return runsByUserId.get(userId) || [];
}

export async function getRun(userId: string, runId: string): Promise<ExplorationRun | null> {
  const userRuns = runsByUserId.get(userId) || [];
  return userRuns.find(r => r.id === runId) || null;
}

export async function updateRunStatus(
  userId: string, 
  runId: string, 
  updates: Partial<Pick<ExplorationRun, 'status' | 'progress' | 'updatedAt'>>
): Promise<ExplorationRun | null> {
  const userRuns = runsByUserId.get(userId) || [];
  const runIndex = userRuns.findIndex(r => r.id === runId);
  
  if (runIndex === -1) {
    return null;
  }
  
  const updatedRun = {
    ...userRuns[runIndex],
    ...updates,
    updatedAt: updates.updatedAt || new Date().toISOString(),
  };
  
  userRuns[runIndex] = updatedRun;
  runsByUserId.set(userId, userRuns);
  
  return updatedRun;
}

// Cleanup function for expired runs (optional)
export async function cleanupExpiredRuns(): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  
  runsByUserId.forEach((runs, userId) => {
    const filteredRuns = runs.filter((run: ExplorationRun) => new Date(run.createdAt) > cutoff);
    if (filteredRuns.length !== runs.length) {
      runsByUserId.set(userId, filteredRuns);
    }
  });
}

// Initialize demo data for a user (development helper)
export async function initializeDemoExplorationData(userId: string): Promise<void> {
  // Only initialize if user has no existing runs
  const existingRuns = await listRuns(userId);
  if (existingRuns.length > 0) {
    return;
  }

  // Add a sample completed run
  const demoRun: ExplorationRun = {
    id: `run_${Date.now()}_demo`,
    userId,
    source: {
      type: "story",
      key: "DEMO-123",
    },
    config: {
      envUrl: "https://staging.example.com",
      role: "recruiter" as const,
      mode: "guided" as const,
      timeBudgetMins: 10,
      maxSteps: 25,
    },
    status: "completed",
    progress: 100,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
  };

  await createRun(demoRun);
}

// Ephemeral user operations
export async function addEphemeralUser(userId: string, user: EphemeralUserRef): Promise<void> {
  const userEphemeralUsers = ephemeralUsersByUserId.get(userId) || [];
  userEphemeralUsers.push(user);
  ephemeralUsersByUserId.set(userId, userEphemeralUsers);
}

export async function getEphemeralUsers(userId: string): Promise<EphemeralUserRef[]> {
  return ephemeralUsersByUserId.get(userId) || [];
}

export async function removeEphemeralUser(userId: string, ephemeralUserId: string): Promise<boolean> {
  const userEphemeralUsers = ephemeralUsersByUserId.get(userId) || [];
  const initialLength = userEphemeralUsers.length;
  const filtered = userEphemeralUsers.filter(u => u.id !== ephemeralUserId);
  
  if (filtered.length !== initialLength) {
    ephemeralUsersByUserId.set(userId, filtered);
    return true;
  }
  
  return false;
}

// Storage state operations
export async function setStorageState(runId: string, storageStateId: string): Promise<void> {
  storageStatesByRunId.set(runId, {
    storageStateId,
    createdAt: new Date().toISOString(),
  });
}

export async function getStorageState(runId: string): Promise<{ storageStateId: string; createdAt: string } | null> {
  return storageStatesByRunId.get(runId) || null;
}

export async function removeStorageState(runId: string): Promise<boolean> {
  return storageStatesByRunId.delete(runId);
}

// Last used environment URL operations
export async function setLastUsedEnvUrl(userId: string, envUrl: string): Promise<void> {
  lastUsedEnvUrlByUserId.set(userId, envUrl);
}

export async function getLastUsedEnvUrl(userId: string): Promise<string | null> {
  return lastUsedEnvUrlByUserId.get(userId) || null;
}

// Bug operations
export async function addBug(bug: Bug): Promise<void> {
  const runBugs = bugsByRunId.get(bug.runId) || [];
  runBugs.push(bug);
  bugsByRunId.set(bug.runId, runBugs);
}

export async function listBugsForRun(runId: string): Promise<Bug[]> {
  return bugsByRunId.get(runId) || [];
}

export async function getBug(runId: string, bugId: string): Promise<Bug | null> {
  const runBugs = bugsByRunId.get(runId) || [];
  return runBugs.find(b => b.id === bugId) || null;
}

export async function updateBug(runId: string, bugId: string, updates: Partial<Bug>): Promise<Bug | null> {
  const runBugs = bugsByRunId.get(runId) || [];
  const bugIndex = runBugs.findIndex(b => b.id === bugId);

  if (bugIndex === -1) {
    return null;
  }

  const updatedBug = {
    ...runBugs[bugIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  runBugs[bugIndex] = updatedBug;
  bugsByRunId.set(runId, runBugs);

  return updatedBug;
}

export async function updateBugJiraStatus(
  runId: string,
  bugId: string,
  jiraStatus: Bug['jiraStatus'],
  jiraIssueKey?: string
): Promise<Bug | null> {
  return await updateBug(runId, bugId, { jiraStatus, jiraIssueKey });
}

export async function deleteBug(runId: string, bugId: string): Promise<boolean> {
  const runBugs = bugsByRunId.get(runId) || [];
  const initialLength = runBugs.length;
  const filtered = runBugs.filter(b => b.id !== bugId);

  if (filtered.length !== initialLength) {
    bugsByRunId.set(runId, filtered);
    return true;
  }

  return false;
}

export async function getBugCountForRun(runId: string): Promise<number> {
  const bugs = bugsByRunId.get(runId) || [];
  return bugs.length;
}

export async function updateRunBugCount(userId: string, runId: string): Promise<void> {
  const bugCount = await getBugCountForRun(runId);
  await updateRunStatus(userId, runId, { bugCount } as any);
}