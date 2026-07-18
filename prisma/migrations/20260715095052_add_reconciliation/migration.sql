-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketplaceId" TEXT,
    "orderNo" TEXT NOT NULL,
    "orderId" TEXT,
    "orderAmount" REAL NOT NULL DEFAULT 0,
    "commission" REAL NOT NULL DEFAULT 0,
    "shipping" REAL NOT NULL DEFAULT 0,
    "returns" REAL NOT NULL DEFAULT 0,
    "deductions" REAL NOT NULL DEFAULT 0,
    "expectedPayment" REAL NOT NULL DEFAULT 0,
    "actualPayment" REAL NOT NULL DEFAULT 0,
    "difference" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "paymentDate" DATETIME,
    "bankAccountId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReconciliationBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketplaceId" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "totalPaid" REAL NOT NULL DEFAULT 0,
    "totalDiff" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'INCELENEN',
    "report" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Reconciliation_marketplaceId_idx" ON "Reconciliation"("marketplaceId");

-- CreateIndex
CREATE INDEX "Reconciliation_orderNo_idx" ON "Reconciliation"("orderNo");

-- CreateIndex
CREATE INDEX "Reconciliation_status_idx" ON "Reconciliation"("status");

-- CreateIndex
CREATE INDEX "Reconciliation_paymentDate_idx" ON "Reconciliation"("paymentDate");

-- CreateIndex
CREATE INDEX "ReconciliationBatch_marketplaceId_idx" ON "ReconciliationBatch"("marketplaceId");

-- CreateIndex
CREATE INDEX "ReconciliationBatch_startDate_endDate_idx" ON "ReconciliationBatch"("startDate", "endDate");
