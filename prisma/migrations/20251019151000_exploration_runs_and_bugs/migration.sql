-- CreateTable
CREATE TABLE "exploration_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "cloudId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "authUsed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "statsJson" JSONB,
    CONSTRAINT "exploration_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bug_findings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stepsJson" JSONB NOT NULL,
    "severity" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "jiraKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bug_findings_runId_fkey" FOREIGN KEY ("runId") REFERENCES "exploration_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "exploration_runs_userId_issueKey_idx" ON "exploration_runs"("userId", "issueKey");
