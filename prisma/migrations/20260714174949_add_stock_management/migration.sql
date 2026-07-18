-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "variantStatus" TEXT NOT NULL DEFAULT 'WAITING_AI',
    "brandMatch" BOOLEAN NOT NULL DEFAULT false,
    "templateMatch" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "criticalStockLevel" INTEGER,
    "autoStockManagement" BOOLEAN NOT NULL DEFAULT false,
    "lastStockCheckAt" DATETIME,
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
INSERT INTO "new_Product" ("aiScore", "aiSuggestedCategoryId", "barcode", "brandId", "brandMatch", "brandUsageType", "categoryId", "categoryMatch", "commissionRate", "computedTitle", "createdAt", "currency", "customBrandName", "description", "detail", "discount", "errorMessage", "id", "images", "lastMatchDate", "link", "matchedBy", "minProfit", "minStock", "originalTitle", "prefixEnabled", "profitMargin", "purchasePrice", "salePrice", "seoDescription", "seoTitle", "sku", "status", "stock", "stockCode", "supplierCategory", "tags", "technicalSpecs", "templateMatch", "title", "unit", "updatedAt", "variantMatch", "variantStatus", "vatRate", "videos", "xmlKey", "xmlSourceId") SELECT "aiScore", "aiSuggestedCategoryId", "barcode", "brandId", "brandMatch", "brandUsageType", "categoryId", "categoryMatch", "commissionRate", "computedTitle", "createdAt", "currency", "customBrandName", "description", "detail", "discount", "errorMessage", "id", "images", "lastMatchDate", "link", "matchedBy", "minProfit", "minStock", "originalTitle", "prefixEnabled", "profitMargin", "purchasePrice", "salePrice", "seoDescription", "seoTitle", "sku", "status", "stock", "stockCode", "supplierCategory", "tags", "technicalSpecs", "templateMatch", "title", "unit", "updatedAt", "variantMatch", "variantStatus", "vatRate", "videos", "xmlKey", "xmlSourceId" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_xmlKey_key" ON "Product"("xmlKey");
CREATE INDEX "Product_variantMatch_idx" ON "Product"("variantMatch");
CREATE INDEX "Product_xmlSourceId_idx" ON "Product"("xmlSourceId");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX "Product_status_idx" ON "Product"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
