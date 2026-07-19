-- CreateTable
CREATE TABLE "AISalesReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL DEFAULT 'trendyol',
    "buyPrice" REAL NOT NULL DEFAULT 0,
    "currentPrice" REAL NOT NULL DEFAULT 0,
    "recommendedPrice" REAL NOT NULL DEFAULT 0,
    "minimumPrice" REAL NOT NULL DEFAULT 0,
    "maximumPrice" REAL NOT NULL DEFAULT 0,
    "profit" REAL NOT NULL DEFAULT 0,
    "profitRate" REAL NOT NULL DEFAULT 0,
    "competitionLevel" INTEGER NOT NULL DEFAULT 0,
    "demandScore" INTEGER NOT NULL DEFAULT 0,
    "velocityScore" INTEGER NOT NULL DEFAULT 0,
    "stockRisk" TEXT NOT NULL DEFAULT 'LOW',
    "recommendation" TEXT NOT NULL DEFAULT 'HOLD',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AIProfitHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "oldPrice" REAL NOT NULL DEFAULT 0,
    "newPrice" REAL NOT NULL DEFAULT 0,
    "oldProfit" REAL NOT NULL DEFAULT 0,
    "newProfit" REAL NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AISalesReport_productId_idx" ON "AISalesReport"("productId");
CREATE INDEX "AISalesReport_marketplace_idx" ON "AISalesReport"("marketplace");
CREATE INDEX "AISalesReport_recommendation_idx" ON "AISalesReport"("recommendation");
CREATE INDEX "AISalesReport_createdAt_idx" ON "AISalesReport"("createdAt");

-- CreateIndex
CREATE INDEX "AIProfitHistory_productId_idx" ON "AIProfitHistory"("productId");
CREATE INDEX "AIProfitHistory_createdAt_idx" ON "AIProfitHistory"("createdAt");
