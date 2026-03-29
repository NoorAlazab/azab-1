import { ExplorationRun, ExplorationSource, ExplorationConfig, ExplorationStatus, Bug } from "./types";
import { createRun, updateRunStatus, getRun, addEphemeralUser, setStorageState, addBug, updateRunBugCount } from "./db";
import { provisionEphemeralUser, loginAndCaptureStorageState } from "./provisioning";

// Generate unique IDs (simple implementation)
function generateId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Create a new exploration run with ephemeral user provisioning
export async function createExplorationRun(
  userId: string,
  source: ExplorationSource,
  config: ExplorationConfig
): Promise<ExplorationRun> {
  const now = new Date().toISOString();
  const runId = generateId();
  
  // Provision ephemeral user
  const ephemeralUser = await provisionEphemeralUser({
    role: config.role,
    envUrl: config.envUrl,
  });
  
  // Store ephemeral user reference
  await addEphemeralUser(userId, ephemeralUser);
  
  // Capture storage state (mocked login)
  const { storageStateId } = await loginAndCaptureStorageState({
    envUrl: config.envUrl,
    role: config.role,
    user: ephemeralUser,
  });
  
  // Store storage state reference
  await setStorageState(runId, storageStateId);
  
  const run: ExplorationRun = {
    id: runId,
    userId,
    source,
    config,
    status: "queued",
    progress: 0,
    ephemeralUserRef: ephemeralUser,
    createdAt: now,
    updatedAt: now,
  };

  await createRun(run);
  
  // Start the mocked progression timer (development only)
  if (process.env.NODE_ENV === 'development') {
    startMockedProgression(userId, run.id);
  }

  return run;
}

// Mocked status progression for development
function startMockedProgression(userId: string, runId: string): void {
  // Transition to 'running' after 5 seconds
  setTimeout(async () => {
    await updateRunStatus(userId, runId, {
      status: "running",
      progress: 10,
    });
  }, 5000);

  // Progress updates every 2 seconds while running
  const progressUpdates = [25, 45, 65, 80, 90];
  progressUpdates.forEach((progress, index) => {
    setTimeout(async () => {
      const run = await getRun(userId, runId);
      if (run && run.status === "running") {
        await updateRunStatus(userId, runId, {
          progress,
        });
      }
    }, 7000 + (index * 2000)); // Start after initial 7s, then every 2s
  });

  // Complete after 15 seconds total
  setTimeout(async () => {
    const run = await getRun(userId, runId);
    if (run && run.status === "running") {
      // Generate mock bugs for testing
      await generateMockBugs(runId);

      // Update bug count
      await updateRunBugCount(userId, runId);

      // Mark as completed
      await updateRunStatus(userId, runId, {
        status: "completed",
        progress: 100,
      });
    }
  }, 15000);
}

// Generate mock bugs for development/testing
async function generateMockBugs(runId: string): Promise<void> {
  const bugs: Bug[] = [
    {
      id: `bug_${Date.now()}_1`,
      runId,
      title: "Console Error: Cannot read property 'name' of undefined",
      description: "A TypeError was detected in the application console during user profile loading.\n\nThis error occurred when attempting to access user.profile.name without proper null checking.\n\nSteps to reproduce:\n1. Navigate to user profile page\n2. Load incomplete user data\n3. Error appears in console",
      severity: "high",
      category: "console_error",
      evidence: [
        {
          type: "console_log",
          content: "TypeError: Cannot read property 'name' of undefined\n    at UserProfile.render (UserProfile.tsx:45)\n    at processComponent (react-dom.js:1234)",
          timestamp: new Date().toISOString(),
          description: "Console error captured during exploration",
        },
      ],
      jiraStatus: "not_published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `bug_${Date.now()}_2`,
      runId,
      title: "Network Error: 404 - User profile endpoint not found",
      description: "Multiple API requests to /api/user/profile failed with 404 status.\n\nThis suggests the endpoint may be missing or incorrectly configured in the staging environment.\n\nAffected URLs:\n- GET /api/user/profile\n- GET /api/user/settings",
      severity: "critical",
      category: "network",
      evidence: [
        {
          type: "network_log",
          content: "URL: https://staging.example.com/api/user/profile\nStatus: 404\nMethod: GET",
          timestamp: new Date().toISOString(),
          description: "Failed network request",
        },
      ],
      jiraStatus: "not_published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `bug_${Date.now()}_3`,
      runId,
      title: "UI Issue: Submit button remains disabled after form validation",
      description: "The form submit button does not enable after all required fields are filled.\n\nExpected behavior: Button should become enabled when form is valid\nActual behavior: Button stays disabled requiring page refresh\n\nThis affects the user registration flow and may prevent new users from signing up.",
      severity: "medium",
      category: "functionality",
      evidence: [
        {
          type: "dom_state",
          content: 'Button element: <button disabled class="submit-btn">Submit</button>\nForm validation state: { email: valid, password: valid, allValid: true }',
          timestamp: new Date().toISOString(),
          description: "DOM state showing disabled button despite valid form",
        },
      ],
      jiraStatus: "not_published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Add bugs to database
  for (const bug of bugs) {
    await addBug(bug);
  }
}

// Get status with progress calculation
export async function getRunStatus(userId: string, runId: string): Promise<ExplorationRun | null> {
  return await getRun(userId, runId);
}

// Validate Jira story key format
export function validateJiraStoryKey(key: string): boolean {
  const jiraKeyPattern = /^[A-Z][A-Z0-9]+-\d+$/;
  return jiraKeyPattern.test(key);
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// Get status badge color
export function getStatusBadgeVariant(status: ExplorationStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "queued":
      return "secondary";
    case "running":
      return "default";
    case "completed":
      return "outline";
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
}