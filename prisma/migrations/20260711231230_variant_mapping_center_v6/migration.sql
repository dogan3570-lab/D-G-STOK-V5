-- CreateTable
CREATE TABLE "VariantPool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentSku" TEXT NOT NULL,
    "productId" TEXT,
    "totalChildren" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "scannedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MarketplaceVariantRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketplaceKey" TEXT NOT NULL,
    "marketplaceName" TEXT NOT NULL,
    "requiredAttributes" TEXT NOT NULL,
    "optionalAttributes" TEXT NOT NULL,
    "maxVariantsPerGroup" INTEGER NOT NULL DEFAULT 100,
    "variantGroupRequired" BOOLEAN NOT NULL DEFAULT true,
    "colorMapping" TEXT,
    "sizeMapping" TEXT,
    "attributeRules" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VariantMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xmlValue" TEXT NOT NULL,
    "attributeType" TEXT NOT NULL,
    "mappedValue" TEXT NOT NULL,
    "marketplaceKey" TEXT,
    "confidence" REAL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VariantValidationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "parentSku" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "errors" TEXT,
    "checks" TEXT,
    "marketplaceKey" TEXT,
    "validatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "VariantPool_parentSku_idx" ON "VariantPool"("parentSku");

-- CreateIndex
CREATE INDEX "VariantPool_status_idx" ON "VariantPool"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceVariantRule_marketplaceKey_key" ON "MarketplaceVariantRule"("marketplaceKey");

-- CreateIndex
CREATE INDEX "VariantMapping_attributeType_idx" ON "VariantMapping"("attributeType");

-- CreateIndex
CREATE INDEX "VariantMapping_marketplaceKey_idx" ON "VariantMapping"("marketplaceKey");

-- CreateIndex
CREATE UNIQUE INDEX "VariantMapping_xmlValue_attributeType_marketplaceKey_key" ON "VariantMapping"("xmlValue", "attributeType", "marketplaceKey");
