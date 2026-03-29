-- CreateTable
CREATE TABLE "jira_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cloudId" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessExpiresAt" DATETIME,
    "refreshCipher" TEXT NOT NULL,
    "scope" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "jira_tokens_userId_key" ON "jira_tokens"("userId");
