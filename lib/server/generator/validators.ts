import { z } from "zod";

// Issue key validation (PROJECT-NUMBER format)
export const IssueKeySchema = z.string().regex(
  /^[A-Z][A-Z0-9]+-\d+$/i,
  "Issue key must be in format PROJECT-123"
);

// Test case component schemas
export const TestPrioritySchema = z.enum(["P0", "P1", "P2", "P3"]);
export const TestTypeSchema = z.enum(["functional", "negative", "boundary", "accessibility", "security", "performance"]);

export const TestStepSchema = z.object({
  action: z.string().min(1, "Action is required"),
  expected: z.string().min(1, "Expected result is required"),
  data: z.string().optional(),
});

export const TestCaseSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
  type: TestTypeSchema,
  priority: TestPrioritySchema,
  preconditions: z.array(z.string()).optional(),
  steps: z.array(TestStepSchema).min(1, "At least one step is required"),
  expected: z.string().min(1, "Expected result is required"),
  tags: z.array(z.string()).optional(),
});
export const WriteModeSchema = z.enum(["comment", "subtasks"]);

// API request/response schemas
export const DraftPayloadSchema = z.object({
  issueKey: IssueKeySchema,
  nCases: z.number().int().min(1).max(50).optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export const PublishBodySchema = z.object({
  issueKey: IssueKeySchema,
  mode: WriteModeSchema,
  cases: z.array(TestCaseSchema).min(1, "At least one test case is required").max(200, "Too many test cases"),
});

export const JiraStorySchema = z.object({
  key: IssueKeySchema,
  summary: z.string().min(1),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  status: z.string(),
  projectKey: z.string(),
  issueType: z.string(),
  priority: z.string().optional(),
  assignee: z.object({
    displayName: z.string(),
    emailAddress: z.string(),
  }).optional(),
});

// Validation helpers
export function validateTestCases(cases: unknown[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!Array.isArray(cases)) {
    return { valid: false, errors: ["Test cases must be an array"] };
  }

  cases.forEach((testCase, index) => {
    const result = TestCaseSchema.safeParse(testCase);
    if (!result.success) {
      result.error.errors.forEach(error => {
        errors.push(`Test case ${index + 1}: ${error.path.join('.')} - ${error.message}`);
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

export function validateIssueKey(key: string): { valid: boolean; error?: string } {
  const result = IssueKeySchema.safeParse(key);
  return {
    valid: result.success,
    error: result.success ? undefined : result.error.errors[0].message,
  };
}

// Type exports for runtime validation
export type DraftPayloadInput = z.infer<typeof DraftPayloadSchema>;
export type PublishBodyInput = z.infer<typeof PublishBodySchema>;
export type JiraStoryInput = z.infer<typeof JiraStorySchema>;