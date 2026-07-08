-- AlterTable
ALTER TABLE "ProductMarketplaceState" ADD COLUMN "errorMessage" TEXT;
ALTER TABLE "ProductMarketplaceState" ADD COLUMN "listingId" TEXT;
ALTER TABLE "ProductMarketplaceState" ADD COLUMN "listingUrl" TEXT;
ALTER TABLE "ProductMarketplaceState" ADD COLUMN "price" REAL;
ALTER TABLE "ProductMarketplaceState" ADD COLUMN "stock" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "name" TEXT;

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketplaceId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "aiSuggestion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ListingTemplate" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ListingTemplate_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FinanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'sale',
    "amount" REAL NOT NULL,
    "commission" REAL,
    "vat" REAL,
    "profit" REAL,
    "productId" TEXT,
    "marketplaceId" TEXT,
    "orderId" TEXT,
    "description" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "meta" TEXT,
    "ipAddress" TEXT,
    "duration" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "actorUserId", "createdAt", "id", "meta") SELECT "action", "actorUserId", "createdAt", "id", "meta" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE TABLE "new_Marketplace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "apiUrl" TEXT,
    "apiStatus" TEXT NOT NULL DEFAULT 'unknown',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Marketplace" ("apiStatus", "createdAt", "id", "key", "name", "updatedAt") SELECT "apiStatus", "createdAt", "id", "key", "name", "updatedAt" FROM "Marketplace";
DROP TABLE "Marketplace";
ALTER TABLE "new_Marketplace" RENAME TO "Marketplace";
CREATE UNIQUE INDEX "Marketplace_key_key" ON "Marketplace"("key");
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNo" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "marketplaceId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "cargoCompany" TEXT,
    "trackingNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "total" REAL NOT NULL,
    "cargoPrice" REAL,
    "commission" REAL,
    "vat" REAL,
    "notes" TEXT,
    "items" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("channel", "createdAt", "customerName", "id", "orderNo", "status", "total", "updatedAt") SELECT "channel", "createdAt", "customerName", "id", "orderNo", "status", "total", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_xmlSourceId_fkey" FOREIGN KEY ("xmlSourceId") REFERENCES "XmlSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("barcode", "brandId", "brandMatch", "categoryId", "categoryMatch", "createdAt", "errorMessage", "id", "minStock", "sku", "status", "stock", "templateMatch", "title", "updatedAt", "variantMatch", "xmlKey") SELECT "barcode", "brandId", "brandMatch", "categoryId", "categoryMatch", "createdAt", "errorMessage", "id", "minStock", "sku", "status", "stock", "templateMatch", "title", "updatedAt", "variantMatch", "xmlKey" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_xmlKey_key" ON "Product"("xmlKey");
CREATE TABLE "new_XmlImportRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'running',
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "newProducts" INTEGER NOT NULL DEFAULT 0,
    "updatedProducts" INTEGER NOT NULL DEFAULT 0,
    "failedProducts" INTEGER NOT NULL DEFAULT 0,
    "skippedProducts" INTEGER NOT NULL DEFAULT 0,
    "deletedProducts" INTEGER NOT NULL DEFAULT 0,
    "errorDetail" TEXT,
    CONSTRAINT "XmlImportRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "XmlSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_XmlImportRun" ("durationMs", "errorDetail", "failedProducts", "finishedAt", "id", "newProducts", "skippedProducts", "sourceId", "startedAt", "status", "totalProducts", "updatedProducts") SELECT "durationMs", "errorDetail", "failedProducts", "finishedAt", "id", "newProducts", "skippedProducts", "sourceId", "startedAt", "status", "totalProducts", "updatedProducts" FROM "XmlImportRun";
DROP TABLE "XmlImportRun";
ALTER TABLE "new_XmlImportRun" RENAME TO "XmlImportRun";
CREATE TABLE "new_XmlSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "url" TEXT,
    "username" TEXT,
    "password" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "vatRate" REAL NOT NULL DEFAULT 20,
    "updateStock" BOOLEAN NOT NULL DEFAULT true,
    "updatePrice" BOOLEAN NOT NULL DEFAULT true,
    "updateImages" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scheduleIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "cronExpression" TEXT,
    "lastRunAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_XmlSource" ("active", "createdAt", "id", "lastError", "lastRunAt", "lastSuccessAt", "name", "scheduleIntervalMinutes", "sourceType", "updatedAt", "url") SELECT "active", "createdAt", "id", "lastError", "lastRunAt", "lastSuccessAt", "name", "scheduleIntervalMinutes", "sourceType", "updatedAt", "url" FROM "XmlSource";
DROP TABLE "XmlSource";
ALTER TABLE "new_XmlSource" RENAME TO "XmlSource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");
