/*
  Warnings:

  - Added the required column `updatedAt` to the `ForbiddenWord` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ForbiddenWordGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "words" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MarketplaceContentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketplaceKey" TEXT NOT NULL,
    "marketplaceName" TEXT NOT NULL,
    "maxTitleLength" INTEGER NOT NULL DEFAULT 150,
    "minTitleLength" INTEGER NOT NULL DEFAULT 10,
    "forbiddenChars" TEXT,
    "emojiPolicy" TEXT NOT NULL DEFAULT 'REMOVE',
    "maxUppercaseRatio" REAL NOT NULL DEFAULT 0.3,
    "allowHtml" BOOLEAN NOT NULL DEFAULT false,
    "allowedHtmlTags" TEXT,
    "minImageWidth" INTEGER NOT NULL DEFAULT 800,
    "minImageHeight" INTEGER NOT NULL DEFAULT 800,
    "maxImageWidth" INTEGER NOT NULL DEFAULT 5000,
    "maxImageHeight" INTEGER NOT NULL DEFAULT 5000,
    "whiteBackground" BOOLEAN NOT NULL DEFAULT true,
    "barcodeRequired" BOOLEAN NOT NULL DEFAULT true,
    "barcodeFormat" TEXT,
    "requiredAttributes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContentAnalysisResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "marketplaceKey" TEXT,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "titleScore" INTEGER NOT NULL DEFAULT 100,
    "descScore" INTEGER NOT NULL DEFAULT 100,
    "imageScore" INTEGER NOT NULL DEFAULT 100,
    "barcodeScore" INTEGER NOT NULL DEFAULT 100,
    "priceScore" INTEGER NOT NULL DEFAULT 100,
    "issues" TEXT,
    "aiSuggestions" TEXT,
    "autoFixed" BOOLEAN NOT NULL DEFAULT false,
    "fixLog" TEXT,
    "aiConfidence" INTEGER NOT NULL DEFAULT 0,
    "aiSuggestedTitle" TEXT,
    "aiSuggestedDesc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApiErrorLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "marketplaceKey" TEXT NOT NULL,
    "errorCode" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "rejectedField" TEXT,
    "aiLearnedRule" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ForbiddenWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "riskLevel" TEXT NOT NULL DEFAULT 'HIGH',
    "marketplaces" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoFix" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ForbiddenWord" ("createdAt", "id", "marketplaces", "word") SELECT "createdAt", "id", "marketplaces", "word" FROM "ForbiddenWord";
DROP TABLE "ForbiddenWord";
ALTER TABLE "new_ForbiddenWord" RENAME TO "ForbiddenWord";
CREATE UNIQUE INDEX "ForbiddenWord_word_key" ON "ForbiddenWord"("word");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ForbiddenWordGroup_name_key" ON "ForbiddenWordGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceContentProfile_marketplaceKey_key" ON "MarketplaceContentProfile"("marketplaceKey");

-- CreateIndex
CREATE INDEX "ContentAnalysisResult_productId_idx" ON "ContentAnalysisResult"("productId");

-- CreateIndex
CREATE INDEX "ContentAnalysisResult_status_idx" ON "ContentAnalysisResult"("status");
