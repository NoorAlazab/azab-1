-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_jira_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cloudId" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessExpiresAt" DATETIME,
    "refreshCipher" TEXT NOT NULL,
    "scope" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "jira_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_jira_tokens" ("accessExpiresAt", "accessToken", "cloudId", "createdAt", "id", "refreshCipher", "scope", "updatedAt", "userId") SELECT "accessExpiresAt", "accessToken", "cloudId", "createdAt", "id", "refreshCipher", "scope", "updatedAt", "userId" FROM "jira_tokens";
DROP TABLE "jira_tokens";
ALTER TABLE "new_jira_tokens" RENAME TO "jira_tokens";
CREATE UNIQUE INDEX "jira_tokens_userId_key" ON "jira_tokens"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
