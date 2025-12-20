-- CreateTable
CREATE TABLE "SessionPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "duration" INTEGER,
    "maxLaps" INTEGER,
    "startedAt" DATETIME,
    "pausedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SessionPhase_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ControllerConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "controller" TEXT NOT NULL,
    "driverId" TEXT,
    "carId" TEXT,
    "trackId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControllerConfig_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ControllerConfig_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ControllerConfig_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "lapTime" REAL NOT NULL,
    "sessionId" TEXT,
    "setAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackRecord_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrackRecord_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrackRecord_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrackRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- DropTable (SessionCar was removed from schema)
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "SessionCar";
PRAGMA foreign_keys=on;

-- RedefineTables for schema changes
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Recreate Session table with new columns
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "championshipId" TEXT,
    "fuelMode" TEXT NOT NULL DEFAULT 'OFF',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "duration" INTEGER,
    "maxLaps" INTEGER,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "syncedAt" DATETIME,
    "cuVersion" TEXT,
    "cuFuelMode" BOOLEAN,
    "cuRealMode" BOOLEAN,
    "cuPitLane" BOOLEAN,
    "cuLapCounter" BOOLEAN,
    "cuNumCars" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("id", "name", "type", "trackId", "championshipId", "fuelMode", "status", "duration", "maxLaps", "startedAt", "finishedAt", "createdAt", "updatedAt")
SELECT "id", "name", "type", "trackId", "championshipId", "fuelMode", "status", "duration", "maxLaps", "startedAt", "finishedAt", "createdAt", "updatedAt" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";

-- Recreate SessionDriver table with new columns
CREATE TABLE "new_SessionDriver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "controller" TEXT NOT NULL,
    "position" INTEGER,
    "gridPos" INTEGER,
    "finalPos" INTEGER,
    CONSTRAINT "SessionDriver_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionDriver_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SessionDriver_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SessionDriver" ("id", "sessionId", "driverId", "position", "gridPos", "finalPos", "carId", "controller")
SELECT "id", "sessionId", "driverId", "position", "gridPos", "finalPos", '', '' FROM "SessionDriver";
DROP TABLE "SessionDriver";
ALTER TABLE "new_SessionDriver" RENAME TO "SessionDriver";

-- Recreate Lap table with new columns
CREATE TABLE "new_Lap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "trackId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "controller" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "lapNumber" INTEGER NOT NULL,
    "lapTime" REAL NOT NULL,
    "speed" REAL,
    "sector1" REAL,
    "sector2" REAL,
    "sector3" REAL,
    "fuelBefore" INTEGER,
    "fuelAfter" INTEGER,
    "isPitLap" BOOLEAN NOT NULL DEFAULT false,
    "pitDuration" REAL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lap_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lap_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lap_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lap_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lap" ("id", "sessionId", "driverId", "lapNumber", "lapTime", "sector1", "sector2", "sector3", "fuelBefore", "fuelAfter", "isPitLap", "pitDuration", "timestamp", "trackId", "carId", "controller", "phase", "speed")
SELECT "id", "sessionId", "driverId", "lapNumber", "lapTime", "sector1", "sector2", "sector3", "fuelBefore", "fuelAfter", "isPitLap", "pitDuration", "timestamp", '', '', '', 'race', NULL FROM "Lap";
DROP TABLE "Lap";
ALTER TABLE "new_Lap" RENAME TO "Lap";

-- Recreate Driver table with number column
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
    "number" INTEGER,
    CONSTRAINT "Driver_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Driver" ("id", "name", "email", "photo", "color", "teamId", "totalRaces", "wins", "podiums", "bestLap", "createdAt", "updatedAt")
SELECT "id", "name", "email", "photo", "color", "teamId", "totalRaces", "wins", "podiums", "bestLap", "createdAt", "updatedAt" FROM "Driver";
DROP TABLE "Driver";
ALTER TABLE "new_Driver" RENAME TO "Driver";

-- Recreate Car table with color column
CREATE TABLE "new_Car" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "photo" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "maxSpeed" INTEGER NOT NULL DEFAULT 100,
    "brakeForce" INTEGER NOT NULL DEFAULT 50,
    "fuelCapacity" INTEGER NOT NULL DEFAULT 100,
    "totalRaces" INTEGER NOT NULL DEFAULT 0,
    "bestLap" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Car" ("id", "brand", "model", "year", "photo", "maxSpeed", "brakeForce", "fuelCapacity", "totalRaces", "bestLap", "createdAt", "updatedAt")
SELECT "id", "brand", "model", "year", "photo", "maxSpeed", "brakeForce", "fuelCapacity", "totalRaces", "bestLap", "createdAt", "updatedAt" FROM "Car";
DROP TABLE "Car";
ALTER TABLE "new_Car" RENAME TO "Car";

-- Recreate Track table with photo and color columns
CREATE TABLE "new_Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "photo" TEXT,
    "layout" TEXT,
    "length" REAL,
    "corners" INTEGER,
    "color" TEXT NOT NULL DEFAULT '#9333ea',
    "bestLap" REAL,
    "bestLapBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Track" ("id", "name", "layout", "length", "corners", "bestLap", "bestLapBy", "createdAt", "updatedAt")
SELECT "id", "name", "layout", "length", "corners", "bestLap", "bestLapBy", "createdAt", "updatedAt" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SessionPhase_sessionId_phase_key" ON "SessionPhase"("sessionId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "ControllerConfig_trackId_controller_key" ON "ControllerConfig"("trackId", "controller");

-- CreateIndex
CREATE UNIQUE INDEX "TrackRecord_trackId_driverId_carId_key" ON "TrackRecord"("trackId", "driverId", "carId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_number_key" ON "Driver"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SessionDriver_sessionId_driverId_key" ON "SessionDriver"("sessionId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionDriver_sessionId_controller_key" ON "SessionDriver"("sessionId", "controller");

-- CreateIndex
CREATE INDEX "Lap_sessionId_driverId_idx" ON "Lap"("sessionId", "driverId");

-- CreateIndex
CREATE INDEX "Lap_sessionId_lapTime_idx" ON "Lap"("sessionId", "lapTime");

-- CreateIndex
CREATE INDEX "Lap_sessionId_phase_idx" ON "Lap"("sessionId", "phase");

-- CreateIndex
CREATE INDEX "Lap_trackId_driverId_lapTime_idx" ON "Lap"("trackId", "driverId", "lapTime");
