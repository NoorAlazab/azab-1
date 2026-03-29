export type TestPriority = "P0" | "P1" | "P2" | "P3";
export type TestType = "functional" | "negative" | "boundary" | "accessibility" | "security" | "performance";
export type WriteMode = "comment" | "subtasks";

export interface TestStep {
  action: string;
  expected: string;
  data?: string;
}

export interface TestCase {
  id?: string; // For UI tracking
  title: string;
  description?: string;
  type: TestType;
  priority: TestPriority;
  preconditions?: string[];
  steps: TestStep[];
  expected: string;
  tags?: string[];
}

export interface JiraStoryDetails {
  key: string;
  summary: string;
  description?: string;
  acceptanceCriteria?: string;
  status: string;
  projectKey: string;
  issueType: string;
  priority?: string;
  assignee?: {
    displayName: string;
    emailAddress: string;
  };
  reporter?: {
    displayName: string;
    emailAddress: string;
  };
  url?: string;
  created?: string;
  updated?: string;
  labels?: string[];
  components?: string[];
}

export interface DraftPayload {
  issueKey: string;
  nCases?: number;        // default 10
  temperature?: number;   // default 0.2
}

export interface DraftResponse {
  cases: TestCase[];
  metadata: {
    generatedAt: string;
    provider?: string;
    model?: string;
    prompt?: string;
  };
}

export interface PublishPayload {
  issueKey: string;
  mode: WriteMode;
  cases: TestCase[];
}

export interface PublishResponse {
  ok: boolean;
  mode: WriteMode;
  commentId?: string;
  created?: Array<{
    key: string;
    id: string;
    title: string;
  }>;
  metadata: {
    totalCases: number;
    publishedAt: string;
  };
}

export interface GeneratorState {
  issueKey: string;
  story?: JiraStoryDetails;
  draft?: DraftResponse;
  cases: TestCase[];
  writeMode: WriteMode;
  isLoading: boolean;
  error?: string;
}