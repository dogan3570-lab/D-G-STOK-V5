-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "details" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "entity" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "entityId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "currency" TEXT;
ALTER TABLE "Product" ADD COLUMN "detail" TEXT;
ALTER TABLE "Product" ADD COLUMN "link" TEXT;
ALTER TABLE "Product" ADD COLUMN "unit" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "preferences" TEXT;

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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "connectionStatus" TEXT NOT NULL DEFAULT 'unknown',
    "purchasePriceVatStatus" TEXT NOT NULL DEFAULT 'dahil',
    "pricingRules" TEXT,
    "fieldMapping" TEXT,
    "purchasePriceField" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_XmlSource" ("active", "company", "createdAt", "cronExpression", "currency", "id", "lastError", "lastRunAt", "lastSuccessAt", "name", "password", "scheduleIntervalMinutes", "sourceType", "updateImages", "updatePrice", "updateStock", "updatedAt", "url", "username", "vatRate") SELECT "active", "company", "createdAt", "cronExpression", "currency", "id", "lastError", "lastRunAt", "lastSuccessAt", "name", "password", "scheduleIntervalMinutes", "sourceType", "updateImages", "updatePrice", "updateStock", "updatedAt", "url", "username", "vatRate" FROM "XmlSource";
DROP TABLE "XmlSource";
ALTER TABLE "new_XmlSource" RENAME TO "XmlSource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
