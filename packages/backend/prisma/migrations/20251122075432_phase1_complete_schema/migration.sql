/*
  Warnings:

  - You are about to drop the `DriverStats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LapTime` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Race` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RaceResult` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `braking` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `team` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `config` on the `Track` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Car` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Championship` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Track` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "DriverStats_driverId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DriverStats";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "LapTime";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Race";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "RaceResult";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "logo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChampionshipStanding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championshipId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ChampionshipStanding_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "championshipId" TEXT,
    "duration" INTEGER,
    "maxLaps" INTEGER,
    "fuelMode" TEXT NOT NULL DEFAULT 'OFF',
    "status" TEXT NOT NULL DEFAULT 'setup',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionDriver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "gridPos" INTEGER,
    "finalPos" INTEGER,
    CONSTRAINT "SessionDriver_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionDriver_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionCar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "maxSpeed" INTEGER NOT NULL,
    "brakeForce" INTEGER NOT NULL,
    "fuelCapacity" INTEGER NOT NULL,
    CONSTRAINT "SessionCar_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionCar_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "lapNumber" INTEGER NOT NULL,
    "lapTime" REAL NOT NULL,
    "sector1" REAL,
    "sector2" REAL,
    "sector3" REAL,
    "fuelBefore" INTEGER,
    "fuelAfter" INTEGER,
    "isPitLap" BOOLEAN NOT NULL DEFAULT false,
    "pitDuration" REAL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lap_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lap_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RaceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RaceEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Car" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "photo" TEXT,
    "maxSpeed" INTEGER NOT NULL DEFAULT 100,
    "brakeForce" INTEGER NOT NULL DEFAULT 50,
    "fuelCapacity" INTEGER NOT NULL DEFAULT 100,
    "totalRaces" INTEGER NOT NULL DEFAULT 0,
    "bestLap" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Car" ("brand", "fuelCapacity", "id", "maxSpeed", "model", "photo", "year") SELECT "brand", "fuelCapacity", "id", "maxSpeed", "model", "photo", "year" FROM "Car";
DROP TABLE "Car";
ALTER TABLE "new_Car" RENAME TO "Car";
CREATE TABLE "new_Championship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "pointsSystem" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Championship" ("id", "name", "pointsSystem", "season") SELECT "id", "name", "pointsSystem", "season" FROM "Championship";
DROP TABLE "Championship";
ALTER TABLE "new_Championship" RENAME TO "Championship";
CREATE TABLE "new_Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "photo" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "teamId" TEXT,
    "totalRaces" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "bestLap" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Driver_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Driver" ("color", "createdAt", "id", "name", "photo") SELECT "color", "createdAt", "id", "name", "photo" FROM "Driver";
DROP TABLE "Driver";
ALTER TABLE "new_Driver" RENAME TO "Driver";
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");
CREATE TABLE "new_Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "layout" TEXT,
    "length" REAL,
    "corners" INTEGER,
    "bestLap" REAL,
    "bestLapBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Track" ("id", "length", "name") SELECT "id", "length", "name" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ChampionshipStanding_championshipId_driverId_key" ON "ChampionshipStanding"("championshipId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionDriver_sessionId_driverId_key" ON "SessionDriver"("sessionId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionDriver_sessionId_position_key" ON "SessionDriver"("sessionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCar_sessionId_carId_key" ON "SessionCar"("sessionId", "carId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCar_sessionId_position_key" ON "SessionCar"("sessionId", "position");

-- CreateIndex
CREATE INDEX "Lap_sessionId_driverId_idx" ON "Lap"("sessionId", "driverId");

-- CreateIndex
CREATE INDEX "Lap_sessionId_lapTime_idx" ON "Lap"("sessionId", "lapTime");

-- CreateIndex
CREATE INDEX "RaceEvent_sessionId_timestamp_idx" ON "RaceEvent"("sessionId", "timestamp");
