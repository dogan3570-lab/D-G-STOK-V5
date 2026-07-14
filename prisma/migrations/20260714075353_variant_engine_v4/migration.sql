-- CreateTable
CREATE TABLE "XmlProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xmlSourceId" TEXT NOT NULL,
    "profileName" TEXT,
    "xmlType" TEXT,
    "hasParentSku" BOOLEAN NOT NULL DEFAULT false,
    "parentSkuUsageRate" REAL NOT NULL DEFAULT 0,
    "hasGroupId" BOOLEAN NOT NULL DEFAULT false,
    "groupIdUsageRate" REAL NOT NULL DEFAULT 0,
    "hasVariationTheme" BOOLEAN NOT NULL DEFAULT false,
    "variationThemeRate" REAL NOT NULL DEFAULT 0,
    "hasColor" BOOLEAN NOT NULL DEFAULT false,
    "colorUsageRate" REAL NOT NULL DEFAULT 0,
    "hasSize" BOOLEAN NOT NULL DEFAULT false,
    "sizeUsageRate" REAL NOT NULL DEFAULT 0,
    "hasNumber" BOOLEAN NOT NULL DEFAULT false,
    "numberUsageRate" REAL NOT NULL DEFAULT 0,
    "hasModel" BOOLEAN NOT NULL DEFAULT false,
    "modelUsageRate" REAL NOT NULL DEFAULT 0,
    "barcodeUsageRate" REAL NOT NULL DEFAULT 0,
    "skuUsageRate" REAL NOT NULL DEFAULT 0,
    "titleQuality" INTEGER NOT NULL DEFAULT 0,
    "categoryQuality" INTEGER NOT NULL DEFAULT 0,
    "attributeQuality" INTEGER NOT NULL DEFAULT 0,
    "dgMode" TEXT NOT NULL DEFAULT 'AUTO',
    "canAutoCreate" BOOLEAN NOT NULL DEFAULT false,
    "lastAnalysisDate" DATETIME,
    "learnedRules" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "XmlProfile_xmlSourceId_fkey" FOREIGN KEY ("xmlSourceId") REFERENCES "XmlSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VariantFamily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentSku" TEXT NOT NULL,
    "groupId" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'DG_AUTO',
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "marketplaceKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "xmlSourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VariantFamily_xmlSourceId_fkey" FOREIGN KEY ("xmlSourceId") REFERENCES "XmlSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VariantFamilyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeName" TEXT,
    "attributeValue" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "assignedBy" TEXT NOT NULL DEFAULT 'DG_AUTO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VariantFamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "VariantFamily" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VariantAnalysis" (
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
    "autoFixAttempted" BOOLEAN NOT NULL DEFAULT false,
    "autoFixResult" TEXT,
    "validationPassed" BOOLEAN NOT NULL DEFAULT false,
    "familyId" TEXT,
    "profileApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VariantAnalysis" ("checkResults", "confidence", "createdAt", "groupId", "id", "parentSku", "productId", "reason", "source", "status", "updatedAt", "xmlHasParent") SELECT "checkResults", "confidence", "createdAt", "groupId", "id", "parentSku", "productId", "reason", "source", "status", "updatedAt", "xmlHasParent" FROM "VariantAnalysis";
DROP TABLE "VariantAnalysis";
ALTER TABLE "new_VariantAnalysis" RENAME TO "VariantAnalysis";
CREATE INDEX "VariantAnalysis_productId_idx" ON "VariantAnalysis"("productId");
CREATE INDEX "VariantAnalysis_status_idx" ON "VariantAnalysis"("status");
CREATE INDEX "VariantAnalysis_confidence_idx" ON "VariantAnalysis"("confidence");
CREATE INDEX "VariantAnalysis_familyId_idx" ON "VariantAnalysis"("familyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "XmlProfile_xmlSourceId_key" ON "XmlProfile"("xmlSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "VariantFamily_parentSku_key" ON "VariantFamily"("parentSku");

-- CreateIndex
CREATE INDEX "VariantFamilyMember_familyId_idx" ON "VariantFamilyMember"("familyId");

-- CreateIndex
CREATE INDEX "VariantFamilyMember_productId_idx" ON "VariantFamilyMember"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "VariantFamilyMember_familyId_productId_key" ON "VariantFamilyMember"("familyId", "productId");
