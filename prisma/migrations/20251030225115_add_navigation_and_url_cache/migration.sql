-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_page_selectors" (
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
    "isNavigationElement" BOOLEAN NOT NULL DEFAULT false,
    "leadsToPage" TEXT,
    "sourcePageName" TEXT,
    "discoveredUrl" TEXT,
    "urlLastVerified" DATETIME,
    "urlVerificationCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "page_selectors_environmentConfigId_fkey" FOREIGN KEY ("environmentConfigId") REFERENCES "environment_configs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_page_selectors" ("elementKey", "elementMetadata", "elementType", "environmentConfigId", "fallbackSelectors", "id", "pageName", "pageUrl", "primarySelector", "recordedAt", "recordedBy") SELECT "elementKey", "elementMetadata", "elementType", "environmentConfigId", "fallbackSelectors", "id", "pageName", "pageUrl", "primarySelector", "recordedAt", "recordedBy" FROM "page_selectors";
DROP TABLE "page_selectors";
ALTER TABLE "new_page_selectors" RENAME TO "page_selectors";
CREATE INDEX "page_selectors_environmentConfigId_pageName_idx" ON "page_selectors"("environmentConfigId", "pageName");
CREATE INDEX "page_selectors_environmentConfigId_isNavigationElement_leadsToPage_idx" ON "page_selectors"("environmentConfigId", "isNavigationElement", "leadsToPage");
CREATE UNIQUE INDEX "page_selectors_environmentConfigId_pageName_elementKey_key" ON "page_selectors"("environmentConfigId", "pageName", "elementKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
