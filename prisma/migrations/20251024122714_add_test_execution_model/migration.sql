-- CreateTable
CREATE TABLE "test_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "testCaseId" TEXT,
    "testCaseTitle" TEXT NOT NULL,
    "testCaseSteps" JSONB NOT NULL,
    "expectedResult" TEXT NOT NULL,
    "priority" TEXT,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actualResult" TEXT,
    "errorMessage" TEXT,
    "screenshotUrl" TEXT,
    "executionLog" JSONB,
    "duration" INTEGER,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "test_executions_runId_fkey" FOREIGN KEY ("runId") REFERENCES "exploration_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "test_executions_runId_idx" ON "test_executions"("runId");
