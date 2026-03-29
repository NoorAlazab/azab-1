/*
  Warnings:

  - You are about to drop the column `environment` on the `test_cases` table. All the data in the column will be lost.
  - You are about to drop the column `issueKey` on the `test_cases` table. All the data in the column will be lost.
  - You are about to drop the column `jiraId` on the `test_cases` table. All the data in the column will be lost.
  - You are about to drop the column `publishedAs` on the `test_cases` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `test_cases` table. All the data in the column will be lost.
  - You are about to drop the column `steps` on the `test_cases` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `test_cases` table. All the data in the column will be lost.
  - Added the required column `stepsJson` to the `test_cases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `suiteId` to the `test_cases` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "test_suites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "cloudId" TEXT NOT NULL,
    "environment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "test_suites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_test_cases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suiteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stepsJson" JSONB NOT NULL,
    "expected" TEXT NOT NULL,
    "priority" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "test_cases_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "test_suites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_test_cases" ("createdAt", "expected", "id", "priority", "title", "updatedAt") SELECT "createdAt", "expected", "id", "priority", "title", "updatedAt" FROM "test_cases";
DROP TABLE "test_cases";
ALTER TABLE "new_test_cases" RENAME TO "test_cases";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "test_suites_userId_issueKey_idx" ON "test_suites"("userId", "issueKey");
