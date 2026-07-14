-- CreateTable
CREATE TABLE "TransformationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "xmlSourceId" TEXT,
    "action" TEXT NOT NULL,
    "oldTitle" TEXT,
    "newTitle" TEXT,
    "oldBrand" TEXT,
    "newBrand" TEXT,
    "oldBrandId" TEXT,
    "newBrandId" TEXT,
    "stepType" TEXT,
    "details" TEXT,
    "actorUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
