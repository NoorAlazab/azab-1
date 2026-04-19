import type { TestCase } from "@/lib/generator/types";

/**
 * Page-local types for the Generator dashboard.
 *
 * Lifted out of page.tsx to keep the page file focused on JSX + handlers.
 * NOT exported from a public surface — these are intentionally internal
 * (the leading underscore in the folder name follows Next.js convention
 * for "private" subdirectories that aren't routed).
 */

export type TestCaseDTO = TestCase;

export type StoryItem = {
  suiteId: string | null;
  issueKey: string;
  cloudId: string;
  story: {
    summary: string;
    description?: string;
    acceptanceCriteria?: string;
    status: string;
    projectKey: string;
    issueType: string;
    url?: string;
  };
  environment?: string;
  cases: TestCaseDTO[];
  dirty: boolean;
  lastSavedAt?: Date | null;
  publishMode: "comment" | "subtasks";
  saving?: boolean;
  publishing?: boolean;
  lastResult?: { ok: boolean; message: string };
};

export type BulkPublishItemResult = {
  suiteId: string;
  issueKey: string;
  ok: boolean;
  message: string;
  detail?: any;
  created?: Array<{ key: string; url?: string }>;
  commentUrl?: string;
  storyUrl?: string;
};

export type BulkPublishResult = {
  ok: boolean;
  mode: string;
  total: number;
  successes: number;
  failures: number;
  results: BulkPublishItemResult[];
};
