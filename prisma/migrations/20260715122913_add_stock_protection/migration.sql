-- CreateTable
CREATE TABLE "StockProtectionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productName" TEXT,
    "marketplaceKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "stockBefore" INTEGER NOT NULL DEFAULT 0,
    "stockAfter" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StockProtectionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xmlSourceId" TEXT,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "closedCount" INTEGER NOT NULL DEFAULT 0,
    "openedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorDetail" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StockProtectionExemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "StockProtectionLog_productId_idx" ON "StockProtectionLog"("productId");

-- CreateIndex
CREATE INDEX "StockProtectionLog_marketplaceKey_idx" ON "StockProtectionLog"("marketplaceKey");

-- CreateIndex
CREATE INDEX "StockProtectionLog_action_idx" ON "StockProtectionLog"("action");

-- CreateIndex
CREATE INDEX "StockProtectionLog_createdAt_idx" ON "StockProtectionLog"("createdAt");

-- CreateIndex
CREATE INDEX "StockProtectionRun_xmlSourceId_idx" ON "StockProtectionRun"("xmlSourceId");

-- CreateIndex
CREATE INDEX "StockProtectionRun_status_idx" ON "StockProtectionRun"("status");

-- CreateIndex
CREATE INDEX "StockProtectionRun_createdAt_idx" ON "StockProtectionRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockProtectionExemption_productId_key" ON "StockProtectionExemption"("productId");
