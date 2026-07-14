-- CreateTable
CREATE TABLE "BrandMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xmlBrandName" TEXT NOT NULL,
    "dgBrandId" TEXT NOT NULL,
    "confidence" REAL,
    "isAuto" BOOLEAN NOT NULL DEFAULT false,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BrandMapping_dgBrandId_fkey" FOREIGN KEY ("dgBrandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BrandLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "xmlBrandName" TEXT,
    "dgBrandId" TEXT,
    "dgBrandName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "prefixChanged" BOOLEAN NOT NULL DEFAULT false,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "details" TEXT,
    "actorUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "logo" TEXT,
    "prefixEnabled" BOOLEAN NOT NULL DEFAULT false,
    "prefixFormat" TEXT NOT NULL DEFAULT 'MARKA® {title}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Brand" ("createdAt", "externalId", "id", "name", "updatedAt") SELECT "createdAt", "externalId", "id", "name", "updatedAt" FROM "Brand";
DROP TABLE "Brand";
ALTER TABLE "new_Brand" RENAME TO "Brand";
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "xmlKey" TEXT NOT NULL,
    "title" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "description" TEXT,
    "technicalSpecs" TEXT,
    "images" TEXT,
    "videos" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "stockCode" TEXT,
    "categoryId" TEXT,
    "brandId" TEXT,
    "categoryMatch" BOOLEAN NOT NULL DEFAULT false,
    "variantMatch" BOOLEAN NOT NULL DEFAULT false,
    "brandMatch" BOOLEAN NOT NULL DEFAULT false,
    "templateMatch" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "purchasePrice" REAL,
    "salePrice" REAL,
    "vatRate" REAL,
    "commissionRate" REAL,
    "profitMargin" REAL,
    "minProfit" REAL,
    "discount" REAL,
    "status" TEXT NOT NULL DEFAULT 'XML',
    "errorMessage" TEXT,
    "tags" TEXT,
    "xmlSourceId" TEXT,
    "link" TEXT,
    "unit" TEXT,
    "currency" TEXT,
    "detail" TEXT,
    "supplierCategory" TEXT,
    "brandUsageType" TEXT NOT NULL DEFAULT 'XML_BRAND',
    "customBrandName" TEXT,
    "prefixEnabled" BOOLEAN NOT NULL DEFAULT false,
    "originalTitle" TEXT,
    "computedTitle" TEXT,
    "aiSuggestedCategoryId" TEXT,
    "aiScore" REAL,
    "matchedBy" TEXT,
    "lastMatchDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_xmlSourceId_fkey" FOREIGN KEY ("xmlSourceId") REFERENCES "XmlSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("aiScore", "aiSuggestedCategoryId", "barcode", "brandId", "brandMatch", "categoryId", "categoryMatch", "commissionRate", "createdAt", "currency", "description", "detail", "discount", "errorMessage", "id", "images", "lastMatchDate", "link", "matchedBy", "minProfit", "minStock", "profitMargin", "purchasePrice", "salePrice", "seoDescription", "seoTitle", "sku", "status", "stock", "stockCode", "supplierCategory", "tags", "technicalSpecs", "templateMatch", "title", "unit", "updatedAt", "variantMatch", "vatRate", "videos", "xmlKey", "xmlSourceId") SELECT "aiScore", "aiSuggestedCategoryId", "barcode", "brandId", "brandMatch", "categoryId", "categoryMatch", "commissionRate", "createdAt", "currency", "description", "detail", "discount", "errorMessage", "id", "images", "lastMatchDate", "link", "matchedBy", "minProfit", "minStock", "profitMargin", "purchasePrice", "salePrice", "seoDescription", "seoTitle", "sku", "status", "stock", "stockCode", "supplierCategory", "tags", "technicalSpecs", "templateMatch", "title", "unit", "updatedAt", "variantMatch", "vatRate", "videos", "xmlKey", "xmlSourceId" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_xmlKey_key" ON "Product"("xmlKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BrandMapping_xmlBrandName_key" ON "BrandMapping"("xmlBrandName");
