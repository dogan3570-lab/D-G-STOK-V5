-- CreateTable
CREATE TABLE "AIKnowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "acceptCount" INTEGER NOT NULL DEFAULT 0,
    "rejectCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AIUserPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "autoApplyThreshold" INTEGER NOT NULL DEFAULT 95,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AIDecisionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "reason" TEXT,
    "autoApplied" BOOLEAN NOT NULL DEFAULT false,
    "accepted" BOOLEAN,
    "actorUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AIKnowledge_module_input_output_key" ON "AIKnowledge"("module", "input", "output");

-- CreateIndex
CREATE UNIQUE INDEX "AIUserPolicy_module_key" ON "AIUserPolicy"("module");
