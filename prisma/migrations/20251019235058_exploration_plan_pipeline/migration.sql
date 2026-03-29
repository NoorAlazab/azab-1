-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_exploration_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "cloudId" TEXT NOT NULL,
    "storySummary" TEXT NOT NULL,
    "storyDescription" TEXT,
    "objectivesJson" JSONB NOT NULL,
    "scopeJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exploration_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_exploration_plans" ("cloudId", "createdAt", "id", "issueKey", "objectivesJson", "scopeJson", "storyDescription", "storySummary", "userId") SELECT "cloudId", "createdAt", "id", "issueKey", "objectivesJson", "scopeJson", "storyDescription", "storySummary", "userId" FROM "exploration_plans";
DROP TABLE "exploration_plans";
ALTER TABLE "new_exploration_plans" RENAME TO "exploration_plans";
CREATE INDEX "exploration_plans_userId_issueKey_idx" ON "exploration_plans"("userId", "issueKey");
CREATE TABLE "new_exploration_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "cloudId" TEXT NOT NULL,
    "planId" TEXT,
    "environment" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "authUsed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "statsJson" JSONB,
    CONSTRAINT "exploration_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "exploration_runs_planId_fkey" FOREIGN KEY ("planId") REFERENCES "exploration_plans" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_exploration_runs" ("authUsed", "cloudId", "environment", "finishedAt", "id", "issueKey", "mode", "planId", "startedAt", "statsJson", "status", "userId") SELECT "authUsed", "cloudId", "environment", "finishedAt", "id", "issueKey", "mode", "planId", "startedAt", "statsJson", "status", "userId" FROM "exploration_runs";
DROP TABLE "exploration_runs";
ALTER TABLE "new_exploration_runs" RENAME TO "exploration_runs";
CREATE INDEX "exploration_runs_userId_issueKey_idx" ON "exploration_runs"("userId", "issueKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
