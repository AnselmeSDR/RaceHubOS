-- Driver and car counters were never kept up to date: figures are computed from the results and the laps
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "img" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "number" INTEGER,
    "preferredCarId" TEXT,
    CONSTRAINT "Driver_preferredCarId_fkey" FOREIGN KEY ("preferredCarId") REFERENCES "Car" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Driver" ("color", "createdAt", "deletedAt", "email", "id", "img", "isReference", "name", "number", "preferredCarId", "updatedAt") SELECT "color", "createdAt", "deletedAt", "email", "id", "img", "isReference", "name", "number", "preferredCarId", "updatedAt" FROM "Driver";
DROP TABLE "Driver";
ALTER TABLE "new_Driver" RENAME TO "Driver";
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");
CREATE UNIQUE INDEX "Driver_number_key" ON "Driver"("number");
CREATE TABLE "new_Car" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "img" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "maxSpeed" INTEGER NOT NULL DEFAULT 100,
    "brakeForce" INTEGER NOT NULL DEFAULT 50,
    "fuelCapacity" INTEGER NOT NULL DEFAULT 100,
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
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Car" ("braids", "brakeForce", "brand", "chassis", "color", "createdAt", "deletedAt", "frontTrackMm", "fuelCapacity", "gearRatio", "groundClearanceMm", "guide", "id", "img", "lengthMm", "magnet", "maxSpeed", "model", "motor", "notes", "rearTrackMm", "scale", "tyresFront", "tyresRear", "updatedAt", "weightGrams", "wheelbaseMm", "widthMm", "year") SELECT "braids", "brakeForce", "brand", "chassis", "color", "createdAt", "deletedAt", "frontTrackMm", "fuelCapacity", "gearRatio", "groundClearanceMm", "guide", "id", "img", "lengthMm", "magnet", "maxSpeed", "model", "motor", "notes", "rearTrackMm", "scale", "tyresFront", "tyresRear", "updatedAt", "weightGrams", "wheelbaseMm", "widthMm", "year" FROM "Car";
DROP TABLE "Car";
ALTER TABLE "new_Car" RENAME TO "Car";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

