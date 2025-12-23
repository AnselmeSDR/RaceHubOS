-- AlterTable
ALTER TABLE "Lap" ADD COLUMN "softDeletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "finishingAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SessionDriver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "controller" TEXT NOT NULL,
    "position" INTEGER,
    "gridPos" INTEGER,
    "finalPos" INTEGER,
    "lapsAtFinishing" INTEGER,
    "totalLaps" INTEGER NOT NULL DEFAULT 0,
    "totalTime" INTEGER NOT NULL DEFAULT 0,
    "isDNF" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SessionDriver_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SessionDriver_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SessionDriver_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SessionDriver" ("carId", "controller", "driverId", "finalPos", "gridPos", "id", "position", "sessionId") SELECT "carId", "controller", "driverId", "finalPos", "gridPos", "id", "position", "sessionId" FROM "SessionDriver";
DROP TABLE "SessionDriver";
ALTER TABLE "new_SessionDriver" RENAME TO "SessionDriver";
CREATE UNIQUE INDEX "SessionDriver_sessionId_driverId_key" ON "SessionDriver"("sessionId", "driverId");
CREATE UNIQUE INDEX "SessionDriver_sessionId_controller_key" ON "SessionDriver"("sessionId", "controller");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Lap_sessionId_softDeletedAt_idx" ON "Lap"("sessionId", "softDeletedAt");
