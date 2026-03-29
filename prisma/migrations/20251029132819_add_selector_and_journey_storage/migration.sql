-- CreateTable
CREATE TABLE "page_selectors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "environmentConfigId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "elementKey" TEXT NOT NULL,
    "primarySelector" TEXT NOT NULL,
    "fallbackSelectors" JSONB NOT NULL,
    "elementType" TEXT NOT NULL,
    "elementMetadata" JSONB NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    CONSTRAINT "page_selectors_environmentConfigId_fkey" FOREIGN KEY ("environmentConfigId") REFERENCES "environment_configs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "page_journeys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "environmentConfigId" TEXT NOT NULL,
    "fromPage" TEXT NOT NULL,
    "toPage" TEXT NOT NULL,
    "navigationSteps" JSONB NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_journeys_environmentConfigId_fkey" FOREIGN KEY ("environmentConfigId") REFERENCES "environment_configs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_execution_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testExecutionId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "strategyUsed" TEXT,
    "elementKey" TEXT,
    "selectorUsed" TEXT,
    "screenshotBeforeUrl" TEXT,
    "screenshotAfterUrl" TEXT,
    "expectedValue" TEXT,
    "actualValue" TEXT,
    "errorMessage" TEXT,
    "failureReason" TEXT,
    "duration" INTEGER,
    "details" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_execution_steps_testExecutionId_fkey" FOREIGN KEY ("testExecutionId") REFERENCES "test_executions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "page_selectors_environmentConfigId_pageName_idx" ON "page_selectors"("environmentConfigId", "pageName");

-- CreateIndex
CREATE UNIQUE INDEX "page_selectors_environmentConfigId_pageName_elementKey_key" ON "page_selectors"("environmentConfigId", "pageName", "elementKey");

-- CreateIndex
CREATE INDEX "page_journeys_environmentConfigId_idx" ON "page_journeys"("environmentConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "page_journeys_environmentConfigId_fromPage_toPage_key" ON "page_journeys"("environmentConfigId", "fromPage", "toPage");

-- CreateIndex
CREATE INDEX "test_execution_steps_testExecutionId_stepNumber_idx" ON "test_execution_steps"("testExecutionId", "stepNumber");
