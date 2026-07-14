-- CreateTable
CREATE TABLE "TitleTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "xmlSourceId" TEXT,
    "brandId" TEXT,
    "categoryId" TEXT,
    "marketplaceId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxLength" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ForbiddenWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "marketplaces" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MarketplaceTitleConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "maxLength" INTEGER NOT NULL DEFAULT 150,
    "seoMaxLength" INTEGER NOT NULL DEFAULT 70,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ForbiddenWord_word_key" ON "ForbiddenWord"("word");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceTitleConfig_key_key" ON "MarketplaceTitleConfig"("key");
