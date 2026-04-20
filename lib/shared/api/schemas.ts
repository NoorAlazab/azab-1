import { z } from "zod";

/**
 * Shared Zod schemas for API request bodies.
 *
 * Co-located here so multiple routes can share the same validators (e.g.
 * the test-case shape is referenced from generator/draft, generator/case,
 * generator/publish). Route-specific one-offs live with their route.
 */

export const issueKeyRegex = /^[A-Z][A-Z0-9_]+-\d+$/;
export const issueKeySchema = z.string().regex(issueKeyRegex, "Expected JIRA issue key like ABC-123");

export const testStepSchema = z.object({
  action: z.string().min(1, "Step action is required"),
  expected: z.string().optional(),
});

export const testCasePrioritySchema = z.enum(["P0", "P1", "P2", "P3"]);
export const testCaseTypeSchema = z.enum([
  "functional",
  "negative",
  "boundary",
  "accessibility",
  "security",
  "performance",
]);

export const testCaseInputSchema = z.object({
  title: z.string().min(1).max(500),
  steps: z.array(testStepSchema).min(1).max(50),
  expected: z.string().min(1).max(2000),
  priority: testCasePrioritySchema.optional().nullable(),
  type: testCaseTypeSchema.optional(),
});

export const generatorDraftSchema = z.object({
  suiteId: z.string().optional(),
  issueKey: issueKeySchema.optional(),
  cloudId: z.string().optional(),
  story: z.object({
    summary: z.string().min(1, "Story summary is required"),
    descriptionText: z.string().optional(),
    acceptanceCriteriaText: z.string().optional(),
  }),
  mode: z.enum(["append", "overwrite"]).optional().default("overwrite"),
  coverage: z.string().optional(),
  maxCases: z.number().int().min(1).max(50).optional(),
  cases: z.array(testCaseInputSchema).optional(),
});
export type GeneratorDraftBody = z.infer<typeof generatorDraftSchema>;

export const generatorSuiteUpsertSchema = z.object({
  issueKey: issueKeySchema,
  cloudId: z.string().min(1, "cloudId is required"),
});
export type GeneratorSuiteUpsertBody = z.infer<typeof generatorSuiteUpsertSchema>;

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginBody = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().max(120).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});
export type SignupBody = z.infer<typeof signupSchema>;
