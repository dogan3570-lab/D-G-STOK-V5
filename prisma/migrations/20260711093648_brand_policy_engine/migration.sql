-- CreateTable
CREATE TABLE "BrandPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "policyType" INTEGER NOT NULL,
    "xmlSourceId" TEXT,
    "dgBrandId" TEXT,
    "prefixFormat" TEXT,
    "separator" TEXT NOT NULL DEFAULT ' | ',
    "removeXmlBrand" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
