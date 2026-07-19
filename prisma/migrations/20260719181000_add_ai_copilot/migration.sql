-- CreateTable
CREATE TABLE "CopilotConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'anonymous',
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CopilotTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CopilotTask_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CopilotConversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CopilotConversation_userId_idx" ON "CopilotConversation"("userId");
CREATE INDEX "CopilotConversation_createdAt_idx" ON "CopilotConversation"("createdAt");

-- CreateIndex
CREATE INDEX "CopilotTask_conversationId_idx" ON "CopilotTask"("conversationId");
CREATE INDEX "CopilotTask_status_idx" ON "CopilotTask"("status");
CREATE INDEX "CopilotTask_module_idx" ON "CopilotTask"("module");
