export type ExplorationMode = "guided" | "freeform";
export type ExplorationStatus = "queued" | "running" | "completed" | "failed";
export type ExplorationRole = "recruiter" | "hiring_manager" | "admin";
export type BugSeverity = "critical" | "high" | "medium" | "low";
export type BugCategory = "functionality" | "ui" | "performance" | "accessibility" | "console_error" | "network" | "other";
export type JiraPublishStatus = "not_published" | "published_comment" | "published_bug" | "publishing" | "failed";

export interface ExplorationConfig {
  envUrl: string;            // required, http(s) only
  role: ExplorationRole;     // required
  mode: ExplorationMode;
  timeBudgetMins: number;    // 1..60
  maxSteps: number;          // 1..500
}

export type ExplorationSource = 
  | { type: "story"; key: string }
  | { type: "pdf"; fileId: string; filename: string; size: number; file?: File };export interface EphemeralUserRef {
  id: string;                // internal id for ephemeral account
  email: string;             // e.g., recruiter+<run-id>@example.test
  role: ExplorationRole;
  createdAt: string;
}

export interface ExplorationRun {
  id: string;
  userId: string;
  source: ExplorationSource;
  config: ExplorationConfig;
  status: ExplorationStatus;
  progress: number;          // 0..100 (mock)
  bugCount?: number;         // number of bugs found
  ephemeralUserRef?: EphemeralUserRef; // server-side only
  createdAt: string;
  updatedAt: string;
}

export interface BugEvidence {
  type: "screenshot" | "console_log" | "network_log" | "dom_state";
  content: string;           // base64 for images, text for logs
  timestamp: string;
  description?: string;
}

export interface Bug {
  id: string;
  runId: string;
  title: string;
  description: string;
  severity: BugSeverity;
  category: BugCategory;
  evidence: BugEvidence[];
  jiraStatus: JiraPublishStatus;
  jiraIssueKey?: string;     // if published as bug ticket
  createdAt: string;
  updatedAt: string;
}

export interface ExplorationFile {
  fileId: string;
  filename: string;
  size: number;
  createdAt: string;
}

export interface UploadResponse {
  fileId: string;
  filename: string;
  size: number;
}

export interface StartExplorationResponse {
  runId: string;
  status: ExplorationStatus;
}

export interface RunStatusResponse extends ExplorationRun {}

export interface RunsResponse {
  runs: ExplorationRun[];
}