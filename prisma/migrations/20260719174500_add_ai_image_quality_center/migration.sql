-- CreateTable
CREATE TABLE "AIImageAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "backgroundScore" INTEGER NOT NULL DEFAULT 0,
    "resolutionScore" INTEGER NOT NULL DEFAULT 0,
    "sharpnessScore" INTEGER NOT NULL DEFAULT 0,
    "lightingScore" INTEGER NOT NULL DEFAULT 0,
    "angleScore" INTEGER NOT NULL DEFAULT 0,
    "watermarkScore" INTEGER NOT NULL DEFAULT 0,
    "shadowScore" INTEGER NOT NULL DEFAULT 0,
    "marketplaceScore" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AIImageIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "confidence" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "recommendation" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AIImageIssue_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AIImageAnalysis" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AIImageAnalysis_productId_idx" ON "AIImageAnalysis"("productId");
CREATE INDEX "AIImageAnalysis_status_idx" ON "AIImageAnalysis"("status");
CREATE INDEX "AIImageAnalysis_overallScore_idx" ON "AIImageAnalysis"("overallScore");
CREATE INDEX "AIImageAnalysis_createdAt_idx" ON "AIImageAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "AIImageIssue_analysisId_idx" ON "AIImageIssue"("analysisId");
CREATE INDEX "AIImageIssue_issueType_idx" ON "AIImageIssue"("issueType");
CREATE INDEX "AIImageIssue_severity_idx" ON "AIImageIssue"("severity");
CREATE INDEX "AIImageIssue_resolved_idx" ON "AIImageIssue"("resolved");
