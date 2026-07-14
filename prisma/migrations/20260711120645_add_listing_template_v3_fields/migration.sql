-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ListingTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "marketplaceId" TEXT,
    "titleFormat" TEXT,
    "description" TEXT,
    "priceFormula" TEXT,
    "commissionRate" REAL,
    "vatRate" REAL,
    "cargoSettings" TEXT,
    "imageSettings" TEXT,
    "categoryId" TEXT,
    "brandId" TEXT,
    "variantSettings" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priceSource" TEXT NOT NULL DEFAULT 'XML_PURCHASE',
    "vatMode" TEXT NOT NULL DEFAULT 'INCLUDED',
    "priceMultiplier" REAL NOT NULL DEFAULT 1.0,
    "priceFixedAmount" REAL NOT NULL DEFAULT 0,
    "priceRangeRules" TEXT,
    "excludeRules" TEXT,
    "titleVariables" TEXT,
    "titleMaxLength" INTEGER,
    "titleSeoMaxLength" INTEGER,
    "descriptionBlocks" TEXT,
    "descriptionMaxLength" INTEGER,
    "imageMinCount" INTEGER,
    "imageMaxCount" INTEGER,
    "imageOrder" TEXT,
    "imageWatermark" TEXT,
    "imageBackground" TEXT,
    "imageMinSize" INTEGER,
    "imageFormat" TEXT,
    "stockMultiplier" INTEGER,
    "stockMinValue" INTEGER,
    "stockMaxValue" INTEGER,
    "stockHide" BOOLEAN NOT NULL DEFAULT false,
    "stockAutoDeactivate" BOOLEAN NOT NULL DEFAULT false,
    "barcodePrefix" TEXT,
    "barcodeSuffix" TEXT,
    "barcodeAutoGenerate" BOOLEAN NOT NULL DEFAULT false,
    "validationRules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ListingTemplate_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ListingTemplate" ("active", "brandId", "cargoSettings", "categoryId", "commissionRate", "createdAt", "description", "id", "imageSettings", "marketplaceId", "name", "priceFormula", "titleFormat", "updatedAt", "variantSettings", "vatRate") SELECT "active", "brandId", "cargoSettings", "categoryId", "commissionRate", "createdAt", "description", "id", "imageSettings", "marketplaceId", "name", "priceFormula", "titleFormat", "updatedAt", "variantSettings", "vatRate" FROM "ListingTemplate";
DROP TABLE "ListingTemplate";
ALTER TABLE "new_ListingTemplate" RENAME TO "ListingTemplate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
