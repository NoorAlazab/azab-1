-- CreateTable
CREATE TABLE "checklists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "connectJira" BOOLEAN NOT NULL DEFAULT false,
    "configureLLM" BOOLEAN NOT NULL DEFAULT false,
    "chooseStorageMode" BOOLEAN NOT NULL DEFAULT false,
    "firstSuite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "checklists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pkce_sessions" (
    "nonce" TEXT NOT NULL PRIMARY KEY,
    "codeVerifier" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "returnTo" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "checklists_userId_key" ON "checklists"("userId");

-- CreateIndex
CREATE INDEX "activity_events_userId_createdAt_idx" ON "activity_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "pkce_sessions_expiresAt_idx" ON "pkce_sessions"("expiresAt");
