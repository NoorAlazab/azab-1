import type { StepAction } from "../stepParser";
import type { VerificationResult } from "../verificationEngine";

/**
 * Public types for test execution.
 *
 * Lifted out of the 1,000+ line testExecutor.ts so consumers can import
 * the types without dragging in Playwright + Prisma + the full execution
 * engine. The implementation file re-exports these for backward compat
 * (`import { TestCase } from "@/lib/server/exploration/testExecutor"` still works).
 */

export interface TestCase {
  id?: string;
  title: string;
  steps: string[];
  expected: string;
  priority?: string;
  type?: string;
}

export interface TestStepResult {
  step: string;
  action: StepAction;
  success: boolean;
  error?: string;
  duration: number;
  /** Which element-finding strategy succeeded (db, guess, etc.) */
  strategyUsed?: string;
  /** Element key consulted in the selector repository, if any */
  elementKey?: string;
  /** Final selector (CSS/XPath/etc.) that was actually used */
  selectorUsed?: string;
  screenshotBeforeUrl?: string;
  screenshotAfterUrl?: string;
  /** Expected value for verification steps */
  expectedValue?: string;
  /** Actual value observed at execution time */
  actualValue?: string;
  /** Free-form failure category, surfaced to the UI */
  failureReason?: string;
  /** Free-form additional context */
  details?: string;
}

export interface TestExecutionResult {
  testCase: TestCase;
  status: "passed" | "failed" | "error";
  steps: TestStepResult[];
  verification?: VerificationResult;
  screenshotPath?: string;
  duration: number;
  error?: string;
}

/**
 * Locally-defined ElementSelector. The selector repository defines its
 * own richer type; this slim variant is what the executor passes around
 * once selectors have been resolved.
 */
export type ElementSelector = {
  key: string;
  primary: string;
  fallbacks: string[];
  metadata: Record<string, any>;
};
