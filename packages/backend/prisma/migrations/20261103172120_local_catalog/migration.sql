-- AlterTable
ALTER TABLE "Car" ADD COLUMN "serial" TEXT;

-- CreateTable
CREATE TABLE "CatalogEntry" (
    "serial" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "img" TEXT,
    "scale" TEXT,
    "chassis" TEXT,
    "motor" TEXT,
    "gearRatio" TEXT,
    "tyresFront" TEXT,
    "tyresRear" TEXT,
    "guide" TEXT,
    "braids" TEXT,
    "magnet" TEXT,
    "notes" TEXT,
    "weightGrams" INTEGER,
    "lengthMm" REAL,
    "widthMm" REAL,
    "wheelbaseMm" REAL,
    "frontTrackMm" REAL,
    "rearTrackMm" REAL,
    "groundClearanceMm" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
