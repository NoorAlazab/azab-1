export type TestCase = {
  id: string;
  title: string;
  steps: string[];
  expected: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  type?: "functional" | "negative" | "boundary" | "accessibility" | "security" | "performance";
};

export type TestCaseDTO = {
  id?: string;
  title: string;
  steps: string[];
  expected: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  type?: "functional" | "negative" | "boundary" | "accessibility" | "security" | "performance";
  order?: number;
};

export type CoveragePreset = 
  | "functional" 
  | "negative" 
  | "boundary" 
  | "accessibility" 
  | "security" 
  | "performance" 
  | "all";

export interface TestSuiteDTO {
  id: string;
  userId: string;
  issueKey: string;
  cloudId: string;
  environment?: string;
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
  testCases?: TestCaseDTO[];
}

export interface GenerateCasesRequest {
  suiteId: string;
  story: {
    summary: string;
    descriptionText?: string;
    acceptanceCriteriaText?: string;
  };
  environment?: string;
  mode?: "overwrite" | "append";
  coverage?: string;
  maxCases?: number;
}

export interface GenerateCasesResponse {
  ok: boolean;
  mode: "overwrite" | "append";
  count: number;
  cases: TestCaseDTO[];
  error?: string;
}