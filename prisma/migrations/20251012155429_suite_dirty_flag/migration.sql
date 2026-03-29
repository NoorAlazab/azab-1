-- AlterTable
ALTER TABLE "test_cases" ADD COLUMN "type" TEXT DEFAULT 'functional';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_test_suites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "cloudId" TEXT NOT NULL,
    "environment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dirty" BOOLEAN NOT NULL DEFAULT false,
    "lastSavedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "test_suites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_test_suites" ("cloudId", "createdAt", "environment", "id", "issueKey", "status", "updatedAt", "userId") SELECT "cloudId", "createdAt", "environment", "id", "issueKey", "status", "updatedAt", "userId" FROM "test_suites";
DROP TABLE "test_suites";
ALTER TABLE "new_test_suites" RENAME TO "test_suites";
CREATE INDEX "test_suites_userId_issueKey_idx" ON "test_suites"("userId", "issueKey");
CREATE UNIQUE INDEX "test_suites_userId_issueKey_key" ON "test_suites"("userId", "issueKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
