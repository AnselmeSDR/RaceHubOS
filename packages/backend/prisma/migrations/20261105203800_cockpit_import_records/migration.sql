-- CreateTable
CREATE TABLE "CockpitImportRecord" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
