-- CreateTable
CREATE TABLE "XmlSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scheduleIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastRunAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastError" TEXT,
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
