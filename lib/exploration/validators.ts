import { z } from "zod";
import type { ExplorationMode, ExplorationSource, ExplorationConfig, ExplorationRole } from "./types";

// Jira story key validation (project-number format)
const jiraKeyPattern = /^[A-Z][A-Z0-9]+-\d+$/;

export const ExplorationModeSchema = z.enum(["guided", "freeform"]);
export const ExplorationRoleSchema = z.enum(["recruiter", "hiring_manager", "admin"]);

export const ExplorationConfigSchema = z.object({
  envUrl: z.string()
    .max(2048, "Environment URL must be less than 2048 characters")
    .refine((url) => /^https?:\/\//.test(url), {
      message: "Environment URL must start with http:// or https://"
    }),
  role: ExplorationRoleSchema,
  mode: ExplorationModeSchema,
  timeBudgetMins: z.number().int().min(1).max(60),
  maxSteps: z.number().int().min(1).max(500),
});

export const StorySourceSchema = z.object({
  type: z.literal("story"),
  key: z.string().regex(jiraKeyPattern, "Invalid Jira story key format (e.g., ABC-123)"),
});

export const PdfSourceSchema = z.object({
  type: z.literal("pdf"),
  fileId: z.string().min(1),
  filename: z.string().min(1),
  size: z.number().int().positive(),
});

export const ExplorationSourceSchema = z.discriminatedUnion("type", [
  StorySourceSchema,
  PdfSourceSchema,
]);

export const StartExplorationBodySchema = z.object({
  source: ExplorationSourceSchema,
  config: ExplorationConfigSchema,
});

export const RunStatusQuerySchema = z.object({
  runId: z.string().min(1),
});

// File upload validation
export const PDF_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_PDF_TYPES = ["application/pdf"];

export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_PDF_TYPES.includes(file.type)) {
    return { valid: false, error: "Only PDF files are allowed" };
  }
  
  if (file.size > PDF_MAX_SIZE) {
    return { valid: false, error: `File size must be less than ${PDF_MAX_SIZE / 1024 / 1024}MB` };
  }
  
  return { valid: true };
}

// Type exports for runtime validation
export type ExplorationConfigInput = z.infer<typeof ExplorationConfigSchema>;
export type ExplorationSourceInput = z.infer<typeof ExplorationSourceSchema>;
export type StartExplorationBodyInput = z.infer<typeof StartExplorationBodySchema>;