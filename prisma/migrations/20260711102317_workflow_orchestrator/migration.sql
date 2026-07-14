-- CreateTable
CREATE TABLE "WorkflowState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IMPORTED',
    "readiness" INTEGER NOT NULL DEFAULT 0,
    "stepCategory" TEXT,
    "stepBrand" TEXT,
    "stepVariant" TEXT,
    "stepTitle" TEXT,
    "stepSeo" TEXT,
    "stepPrice" TEXT,
    "stepImage" TEXT,
    "stepBarcode" TEXT,
    "stepStock" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkflowTimeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "details" TEXT,
    "actorUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowState_productId_key" ON "WorkflowState"("productId");
