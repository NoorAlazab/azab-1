-- AlterTable
ALTER TABLE "bug_findings" ADD COLUMN "objectiveId" TEXT;
ALTER TABLE "bug_findings" ADD COLUMN "relevance" REAL;

-- AlterTable
ALTER TABLE "exploration_runs" ADD COLUMN "planId" TEXT;

-- CreateTable
CREATE TABLE "exploration_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "cloudId" TEXT NOT NULL,
    "storySummary" TEXT NOT NULL,
    "storyDescription" TEXT,
    "objectivesJson" JSONB NOT NULL,
    "scopeJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "exploration_plans_userId_issueKey_idx" ON "exploration_plans"("userId", "issueKey");
