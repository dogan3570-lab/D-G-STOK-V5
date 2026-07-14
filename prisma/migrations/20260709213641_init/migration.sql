-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferences" TEXT
);

-- CreateTable
CREATE TABLE "Marketplace" (
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

-- CreateTable
CREATE TABLE "Product" (
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

-- CreateTable
CREATE TABLE "ProductMarketplaceState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'XML',
    "listingId" TEXT,
    "listingUrl" TEXT,
    "lastActionAt" DATETIME,
    "externalRef" TEXT,
    "price" REAL,
    "stock" INTEGER,
    "errorMessage" TEXT,
    CONSTRAINT "ProductMarketplaceState_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductMarketplaceState_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QueueJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XmlSource" (
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
    "connectionStatus" TEXT NOT NULL DEFAULT 'unknown',
    "purchasePriceVatStatus" TEXT NOT NULL DEFAULT 'dahil',
    "pricingRules" TEXT,
    "fieldMapping" TEXT,
    "purchasePriceField" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XmlImportRun" (
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

-- CreateTable
CREATE TABLE "XmlImportItemResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importRunId" TEXT NOT NULL,
    "xmlKey" TEXT NOT NULL,
    "sku" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'created',
    "errorDetail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "XmlImportItemResult_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "XmlImportRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "meta" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "duration" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoryMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "marketplaceId" TEXT,
    "externalId" TEXT,
    "externalName" TEXT,
    "externalPath" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "confidence" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CategoryMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CategoryMapping_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
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

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "channel" TEXT NOT NULL,
    "cargoCompany" TEXT NOT NULL,
    "trackingNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerConfig" TEXT,
    "actionType" TEXT NOT NULL,
    "actionConfig" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "schedule" TEXT,
    "marketplaceId" TEXT,
    "lastRunAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceRecord_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinanceRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Marketplace_key_key" ON "Marketplace"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Product_xmlKey_key" ON "Product"("xmlKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMarketplaceState_productId_marketplaceId_key" ON "ProductMarketplaceState"("productId", "marketplaceId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueJob_idempotencyKey_key" ON "QueueJob"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryMapping_categoryId_marketplaceId_source_key" ON "CategoryMapping"("categoryId", "marketplaceId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_productId_name_value_key" ON "Variant"("productId", "name", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");
