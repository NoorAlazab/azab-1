-- CreateTable
CREATE TABLE "environment_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "environmentUrl" TEXT NOT NULL,
    "environmentSlug" TEXT NOT NULL,
    "usernameEncrypted" TEXT,
    "passwordEncrypted" TEXT,
    "pagesMetadataJson" JSONB,
    "lastRecordedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "environment_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "environment_configs_userId_environmentSlug_idx" ON "environment_configs"("userId", "environmentSlug");

-- CreateIndex
CREATE UNIQUE INDEX "environment_configs_userId_environmentSlug_key" ON "environment_configs"("userId", "environmentSlug");
