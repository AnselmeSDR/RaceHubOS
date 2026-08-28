-- AlterTable
ALTER TABLE "Session" ADD COLUMN "autoGroup" INTEGER;

-- CreateTable
CREATE TABLE "ChampionshipParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championshipId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChampionshipParticipant_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChampionshipParticipant_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Championship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "trackId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "driversPerQualif" INTEGER,
    "driversPerRace" INTEGER,
    "qualifMaxDuration" INTEGER,
    "qualifMaxLaps" INTEGER,
    "raceMaxDuration" INTEGER,
    "raceMaxLaps" INTEGER,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Championship_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Championship" ("createdAt", "deletedAt", "id", "name", "season", "status", "trackId", "updatedAt") SELECT "createdAt", "deletedAt", "id", "name", "season", "status", "trackId", "updatedAt" FROM "Championship";
DROP TABLE "Championship";
ALTER TABLE "new_Championship" RENAME TO "Championship";
CREATE TABLE "new_Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "img" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "teamId" TEXT,
    "totalRaces" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "bestLap" REAL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "number" INTEGER,
    CONSTRAINT "Driver_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Driver" ("bestLap", "color", "createdAt", "deletedAt", "email", "id", "img", "name", "number", "podiums", "teamId", "totalRaces", "updatedAt", "wins") SELECT "bestLap", "color", "createdAt", "deletedAt", "email", "id", "img", "name", "number", "podiums", "teamId", "totalRaces", "updatedAt", "wins" FROM "Driver";
DROP TABLE "Driver";
ALTER TABLE "new_Driver" RENAME TO "Driver";
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");
CREATE UNIQUE INDEX "Driver_number_key" ON "Driver"("number");
CREATE TABLE "new_Lap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "driverId" TEXT,
    "carId" TEXT NOT NULL,
    "controller" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "lapNumber" INTEGER NOT NULL,
    "lapTime" REAL NOT NULL,
    "sector1" REAL,
    "sector2" REAL,
    "sector3" REAL,
    "deletedAt" DATETIME,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lap_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lap_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lap_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lap_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lap" ("carId", "controller", "deletedAt", "driverId", "id", "lapNumber", "lapTime", "phase", "sector1", "sector2", "sector3", "sessionId", "timestamp", "trackId") SELECT "carId", "controller", "deletedAt", "driverId", "id", "lapNumber", "lapTime", "phase", "sector1", "sector2", "sector3", "sessionId", "timestamp", "trackId" FROM "Lap";
DROP TABLE "Lap";
ALTER TABLE "new_Lap" RENAME TO "Lap";
CREATE INDEX "Lap_sessionId_driverId_idx" ON "Lap"("sessionId", "driverId");
CREATE INDEX "Lap_sessionId_lapTime_idx" ON "Lap"("sessionId", "lapTime");
CREATE INDEX "Lap_sessionId_phase_idx" ON "Lap"("sessionId", "phase");
CREATE INDEX "Lap_sessionId_deletedAt_idx" ON "Lap"("sessionId", "deletedAt");
CREATE INDEX "Lap_trackId_driverId_lapTime_idx" ON "Lap"("trackId", "driverId", "lapTime");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ChampionshipParticipant_championshipId_driverId_key" ON "ChampionshipParticipant"("championshipId", "driverId");
