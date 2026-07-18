-- CreateTable
CREATE TABLE "MarketplacePricingRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketplaceId" TEXT NOT NULL,
    "productId" TEXT,
    "categoryId" TEXT,
    "minPrice" REAL NOT NULL DEFAULT 0,
    "maxPrice" REAL NOT NULL DEFAULT 999999,
    "applyVat" BOOLEAN NOT NULL DEFAULT true,
    "profitMargin" REAL NOT NULL DEFAULT 75,
    "rounding" TEXT NOT NULL DEFAULT '0.90',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ListingLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "ruleId" TEXT,
    "ruleType" TEXT NOT NULL,
    "purchasePrice" REAL NOT NULL,
    "vatIncludedPrice" REAL NOT NULL,
    "profitMargin" REAL NOT NULL,
    "rounding" TEXT NOT NULL,
    "calculatedPrice" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "MarketplacePricingRule_marketplaceId_idx" ON "MarketplacePricingRule"("marketplaceId");

-- CreateIndex
CREATE INDEX "MarketplacePricingRule_productId_idx" ON "MarketplacePricingRule"("productId");

-- CreateIndex
CREATE INDEX "MarketplacePricingRule_categoryId_idx" ON "MarketplacePricingRule"("categoryId");

-- CreateIndex
CREATE INDEX "ListingLog_productId_idx" ON "ListingLog"("productId");

-- CreateIndex
CREATE INDEX "ListingLog_marketplaceId_idx" ON "ListingLog"("marketplaceId");

-- CreateIndex
CREATE INDEX "ListingLog_createdAt_idx" ON "ListingLog"("createdAt");
