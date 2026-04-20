import { log } from "@/lib/utils/logger";
import type { TestStepResult } from "./types";

/**
 * Persist a single executed step into TestExecutionStep.
 *
 * Extracted from testExecutor.ts to keep the orchestration file shorter
 * and the persistence concern isolated. Errors are swallowed and logged:
 * a database write failure must NOT abort the in-flight test execution.
 */
export async function saveStepToDatabase(
  testExecutionId: string,
  stepNumber: number,
  description: string,
  stepResult: TestStepResult,
): Promise<void> {
  try {
    const { prisma } = await import("@/lib/server/db/prisma");

    await prisma.testExecutionStep.create({
      data: {
        testExecutionId,
        stepNumber,
        description,
        status: stepResult.success ? "passed" : "failed",
        strategyUsed: stepResult.strategyUsed,
        elementKey: stepResult.elementKey,
        selectorUsed: stepResult.selectorUsed,
        screenshotBeforeUrl: stepResult.screenshotBeforeUrl,
        screenshotAfterUrl: stepResult.screenshotAfterUrl,
        expectedValue: stepResult.expectedValue,
        actualValue: stepResult.actualValue,
        errorMessage: stepResult.error,
        failureReason: stepResult.failureReason,
        duration: stepResult.duration,
        details: stepResult.details,
      },
    });

    log.debug("Saved step to database", {
      module: "TestExecutor",
      testExecutionId,
      stepNumber,
      status: stepResult.success ? "passed" : "failed",
    });
  } catch (error) {
    log.error(
      "Failed to save step to database",
      error instanceof Error ? error : new Error(String(error)),
      {
        module: "TestExecutor",
        testExecutionId,
        stepNumber,
      },
    );
  }
}
