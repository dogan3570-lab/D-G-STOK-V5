-- CreateTable
CREATE TABLE "VariantAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "parentSku" TEXT,
    "groupId" TEXT,
    "xmlHasParent" BOOLEAN NOT NULL DEFAULT false,
    "checkResults" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VariantThreshold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "VariantAnalysis_productId_idx" ON "VariantAnalysis"("productId");

-- CreateIndex
CREATE INDEX "VariantAnalysis_status_idx" ON "VariantAnalysis"("status");

-- CreateIndex
CREATE INDEX "VariantAnalysis_confidence_idx" ON "VariantAnalysis"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "VariantThreshold_key_key" ON "VariantThreshold"("key");

-- CreateIndex
CREATE INDEX "VariantThreshold_key_idx" ON "VariantThreshold"("key");
