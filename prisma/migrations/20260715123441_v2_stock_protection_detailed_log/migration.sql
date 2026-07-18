/*
  Warnings:

  - Added the required column `decision` to the `StockProtectionLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "StockProtectionExemption" ADD COLUMN "productName" TEXT;
ALTER TABLE "StockProtectionExemption" ADD COLUMN "sku" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockProtectionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productName" TEXT,
    "barcode" TEXT,
    "xmlSourceId" TEXT,
    "xmlSourceName" TEXT,
    "marketplaceKey" TEXT NOT NULL,
    "marketplaceName" TEXT,
    "action" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "stockBefore" INTEGER NOT NULL DEFAULT 0,
    "stockAfter" INTEGER NOT NULL DEFAULT 0,
    "criticalLevel" INTEGER NOT NULL DEFAULT 3,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "httpStatus" INTEGER,
    "apiResponse" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_StockProtectionLog" ("action", "createdAt", "durationMs", "errorMessage", "id", "marketplaceKey", "productId", "productName", "reason", "sku", "stockAfter", "stockBefore", "success") SELECT "action", "createdAt", "durationMs", "errorMessage", "id", "marketplaceKey", "productId", "productName", "reason", "sku", "stockAfter", "stockBefore", "success" FROM "StockProtectionLog";
DROP TABLE "StockProtectionLog";
ALTER TABLE "new_StockProtectionLog" RENAME TO "StockProtectionLog";
CREATE INDEX "StockProtectionLog_productId_idx" ON "StockProtectionLog"("productId");
CREATE INDEX "StockProtectionLog_sku_idx" ON "StockProtectionLog"("sku");
CREATE INDEX "StockProtectionLog_xmlSourceId_idx" ON "StockProtectionLog"("xmlSourceId");
CREATE INDEX "StockProtectionLog_marketplaceKey_idx" ON "StockProtectionLog"("marketplaceKey");
CREATE INDEX "StockProtectionLog_action_idx" ON "StockProtectionLog"("action");
CREATE INDEX "StockProtectionLog_triggerType_idx" ON "StockProtectionLog"("triggerType");
CREATE INDEX "StockProtectionLog_createdAt_idx" ON "StockProtectionLog"("createdAt");
CREATE TABLE "new_StockProtectionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xmlSourceId" TEXT,
    "xmlSourceName" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'XML_SCHEDULER',
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "closedCount" INTEGER NOT NULL DEFAULT 0,
    "openedCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorDetail" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_StockProtectionRun" ("closedCount", "createdAt", "durationMs", "errorCount", "errorDetail", "finishedAt", "id", "openedCount", "productCount", "startedAt", "status", "xmlSourceId") SELECT "closedCount", "createdAt", "durationMs", "errorCount", "errorDetail", "finishedAt", "id", "openedCount", "productCount", "startedAt", "status", "xmlSourceId" FROM "StockProtectionRun";
DROP TABLE "StockProtectionRun";
ALTER TABLE "new_StockProtectionRun" RENAME TO "StockProtectionRun";
CREATE INDEX "StockProtectionRun_xmlSourceId_idx" ON "StockProtectionRun"("xmlSourceId");
CREATE INDEX "StockProtectionRun_triggerType_idx" ON "StockProtectionRun"("triggerType");
CREATE INDEX "StockProtectionRun_status_idx" ON "StockProtectionRun"("status");
CREATE INDEX "StockProtectionRun_createdAt_idx" ON "StockProtectionRun"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
