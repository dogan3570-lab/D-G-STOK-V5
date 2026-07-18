-- CreateTable
CREATE TABLE "FinanceAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bankName" TEXT,
    "iban" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "balance" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinanceTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "FinanceAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinanceTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "FinanceAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinanceExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "expenseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptNo" TEXT,
    "supplier" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "FinanceIncome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "incomeDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptNo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "FinancePayable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "dueDate" DATETIME,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "FinancePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payableId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paymentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancePayment_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "FinancePayable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinanceAlarm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "referenceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "FinanceTransaction_accountId_idx" ON "FinanceTransaction"("accountId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_type_idx" ON "FinanceTransaction"("type");

-- CreateIndex
CREATE INDEX "FinanceTransaction_createdAt_idx" ON "FinanceTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "FinanceTransaction_category_idx" ON "FinanceTransaction"("category");

-- CreateIndex
CREATE INDEX "FinanceTransfer_fromAccountId_idx" ON "FinanceTransfer"("fromAccountId");

-- CreateIndex
CREATE INDEX "FinanceTransfer_toAccountId_idx" ON "FinanceTransfer"("toAccountId");

-- CreateIndex
CREATE INDEX "FinanceExpense_category_idx" ON "FinanceExpense"("category");

-- CreateIndex
CREATE INDEX "FinanceExpense_expenseDate_idx" ON "FinanceExpense"("expenseDate");

-- CreateIndex
CREATE INDEX "FinanceIncome_category_idx" ON "FinanceIncome"("category");

-- CreateIndex
CREATE INDEX "FinanceIncome_incomeDate_idx" ON "FinanceIncome"("incomeDate");

-- CreateIndex
CREATE INDEX "FinancePayable_type_idx" ON "FinancePayable"("type");

-- CreateIndex
CREATE INDEX "FinancePayable_status_idx" ON "FinancePayable"("status");

-- CreateIndex
CREATE INDEX "FinancePayable_dueDate_idx" ON "FinancePayable"("dueDate");

-- CreateIndex
CREATE INDEX "FinancePayment_payableId_idx" ON "FinancePayment"("payableId");

-- CreateIndex
CREATE INDEX "FinanceAlarm_type_idx" ON "FinanceAlarm"("type");

-- CreateIndex
CREATE INDEX "FinanceAlarm_severity_idx" ON "FinanceAlarm"("severity");

-- CreateIndex
CREATE INDEX "FinanceAlarm_isResolved_idx" ON "FinanceAlarm"("isResolved");
