import { analyzeBugs } from "@/lib/ai/client";
import type { Bug, BugEvidence, BugSeverity, BugCategory } from "./types";
import { log } from '@/lib/utils/logger';

export interface ExplorationResults {
  testScenarios: string[];
  actions: Array<{
    type: string;
    target?: string;
    timestamp: string;
    success: boolean;
    error?: string;
    screenshot?: string;
  }>;
  consoleErrors: Array<{
    message: string;
    timestamp: string;
    stack?: string;
  }>;
  failedRequests: Array<{
    url: string;
    status: number;
    timestamp: string;
  }>;
  screenshots: Array<{
    timestamp: string;
    data: string; // base64
    description: string;
  }>;
}

/**
 * Generate unique bug ID
 */
function generateBugId(): string {
  return `bug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create exploration log from actions
 */
function createExplorationLog(results: ExplorationResults): string {
  const log = results.actions.map((action, index) => {
    const status = action.success ? "✓" : "✗";
    const error = action.error ? ` (${action.error})` : "";
    return `${index + 1}. [${status}] ${action.type} ${action.target || ""}${error}`;
  }).join('\n');

  return log;
}

/**
 * Detect bugs from exploration results using AI analysis
 */
export async function detectBugs(
  runId: string,
  results: ExplorationResults
): Promise<Bug[]> {
  const bugs: Bug[] = [];

  // Prepare data for AI analysis
  const explorationLog = createExplorationLog(results);
  const consoleErrorMessages = results.consoleErrors.map(e => e.message);
  const failedRequestUrls = results.failedRequests.map(r => `${r.url} (${r.status})`);

  // Use AI to analyze and identify bugs
  try {
    const aiBugs = await analyzeBugs(
      results.testScenarios,
      explorationLog,
      consoleErrorMessages,
      failedRequestUrls
    );

    // Convert AI-identified bugs to Bug objects
    for (const aiBug of aiBugs) {
      const evidence: BugEvidence[] = [];

      // Add console error evidence if relevant
      const relevantConsoleErrors = results.consoleErrors.filter(e =>
        aiBug.description.toLowerCase().includes(e.message.toLowerCase().substring(0, 30))
      );
      for (const error of relevantConsoleErrors.slice(0, 3)) {
        evidence.push({
          type: "console_log",
          content: `${error.message}\n${error.stack || ""}`,
          timestamp: error.timestamp,
          description: "Console error captured during exploration",
        });
      }

      // Add failed request evidence if relevant
      const relevantFailedRequests = results.failedRequests.filter(r =>
        aiBug.description.includes(r.url)
      );
      for (const req of relevantFailedRequests.slice(0, 3)) {
        evidence.push({
          type: "network_log",
          content: `URL: ${req.url}\nStatus: ${req.status}`,
          timestamp: req.timestamp,
          description: "Failed network request",
        });
      }

      // Add relevant screenshots
      const relevantScreenshots = results.screenshots.filter(s =>
        s.description.toLowerCase().includes("error") ||
        s.description.toLowerCase().includes("failed")
      );
      for (const screenshot of relevantScreenshots.slice(0, 2)) {
        evidence.push({
          type: "screenshot",
          content: screenshot.data,
          timestamp: screenshot.timestamp,
          description: screenshot.description,
        });
      }

      // If no specific evidence, add the most recent screenshot
      if (evidence.length === 0 && results.screenshots.length > 0) {
        const lastScreenshot = results.screenshots[results.screenshots.length - 1];
        evidence.push({
          type: "screenshot",
          content: lastScreenshot.data,
          timestamp: lastScreenshot.timestamp,
          description: lastScreenshot.description,
        });
      }

      const bug: Bug = {
        id: generateBugId(),
        runId,
        title: aiBug.title,
        description: aiBug.description,
        severity: aiBug.severity as BugSeverity,
        category: aiBug.category as BugCategory,
        evidence,
        jiraStatus: "not_published",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      bugs.push(bug);
    }
  } catch (error) {
    log.error("AI bug analysis failed", error instanceof Error ? error : new Error(String(error)), { module: 'BugDetector', runId });

    // Fallback: Create bugs from console errors and failed requests
    bugs.push(...detectConsoleErrorBugs(runId, results));
    bugs.push(...detectFailedRequestBugs(runId, results));
  }

  return bugs;
}

/**
 * Detect bugs from console errors (fallback method)
 */
function detectConsoleErrorBugs(
  runId: string,
  results: ExplorationResults
): Bug[] {
  const bugs: Bug[] = [];

  // Group console errors by message
  const errorGroups = new Map<string, typeof results.consoleErrors>();

  for (const error of results.consoleErrors) {
    const key = error.message.substring(0, 100);
    if (!errorGroups.has(key)) {
      errorGroups.set(key, []);
    }
    errorGroups.get(key)!.push(error);
  }

  // Create a bug for each error group
  for (const [key, errors] of Array.from(errorGroups.entries())) {
    const firstError = errors[0];

    const evidence: BugEvidence[] = [{
      type: "console_log",
      content: `${firstError.message}\n${firstError.stack || ""}`,
      timestamp: firstError.timestamp,
      description: `Console error (occurred ${errors.length} time${errors.length > 1 ? 's' : ''})`,
    }];

    bugs.push({
      id: generateBugId(),
      runId,
      title: `Console Error: ${firstError.message.substring(0, 80)}`,
      description: `A console error was detected during exploration:\n\n${firstError.message}\n\nThis error occurred ${errors.length} time(s).`,
      severity: "medium",
      category: "console_error",
      evidence,
      jiraStatus: "not_published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return bugs;
}

/**
 * Detect bugs from failed network requests (fallback method)
 */
function detectFailedRequestBugs(
  runId: string,
  results: ExplorationResults
): Bug[] {
  const bugs: Bug[] = [];

  // Group by status code
  const requestGroups = new Map<number, typeof results.failedRequests>();

  for (const req of results.failedRequests) {
    if (!requestGroups.has(req.status)) {
      requestGroups.set(req.status, []);
    }
    requestGroups.get(req.status)!.push(req);
  }

  // Create bugs for 4xx and 5xx errors
  for (const [status, requests] of Array.from(requestGroups.entries())) {
    if (status < 400) continue;

    const severity: BugSeverity =
      status >= 500 ? "high" :
      status === 404 ? "medium" :
      "low";

    const evidence: BugEvidence[] = requests.slice(0, 5).map((req: typeof results.failedRequests[0]) => ({
      type: "network_log",
      content: `URL: ${req.url}\nStatus: ${req.status}`,
      timestamp: req.timestamp,
      description: "Failed network request",
    }));

    bugs.push({
      id: generateBugId(),
      runId,
      title: `Network Error: ${status} ${requests.length} request${requests.length > 1 ? 's' : ''} failed`,
      description: `Multiple network requests failed with status ${status}:\n\n${requests.map((r: typeof results.failedRequests[0]) => `- ${r.url}`).join('\n')}`,
      severity,
      category: "network",
      evidence,
      jiraStatus: "not_published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return bugs;
}

/**
 * Create mock exploration results for testing
 */
export function createMockExplorationResults(testScenarios: string[]): ExplorationResults {
  return {
    testScenarios,
    actions: [
      {
        type: "navigate",
        target: "https://staging.example.com",
        timestamp: new Date().toISOString(),
        success: true,
      },
      {
        type: "click",
        target: "button.login",
        timestamp: new Date().toISOString(),
        success: false,
        error: "Element not found",
      },
    ],
    consoleErrors: [
      {
        message: "TypeError: Cannot read property 'name' of undefined",
        timestamp: new Date().toISOString(),
        stack: "at getUserName (app.js:123)",
      },
    ],
    failedRequests: [
      {
        url: "https://staging.example.com/api/user/profile",
        status: 404,
        timestamp: new Date().toISOString(),
      },
    ],
    screenshots: [],
  };
}
