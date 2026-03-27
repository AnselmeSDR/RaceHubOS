-- CreateTable
CREATE TABLE "Car" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "img" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "maxSpeed" INTEGER NOT NULL DEFAULT 100,
    "brakeForce" INTEGER NOT NULL DEFAULT 50,
    "fuelCapacity" INTEGER NOT NULL DEFAULT 100,
    "totalRaces" INTEGER NOT NULL DEFAULT 0,
    "bestLap" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Championship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "trackId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Championship_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ControllerConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "controller" INTEGER NOT NULL,
    "driverId" TEXT,
    "carId" TEXT,
    "trackId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControllerConfig_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ControllerConfig_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ControllerConfig_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'cu',
    "lastConnected" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "img" TEXT,
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

-- CreateTable
CREATE TABLE "Lap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "controller" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "lapNumber" INTEGER NOT NULL,
    "lapTime" REAL NOT NULL,
    "sector1" REAL,
    "sector2" REAL,
    "sector3" REAL,
    "softDeletedAt" DATETIME,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lap_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lap_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lap_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lap_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "championshipId" TEXT,
    "fuelMode" TEXT NOT NULL DEFAULT 'OFF',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "maxDuration" INTEGER,
    "maxLaps" INTEGER,
    "gracePeriod" INTEGER,
    "pauses" TEXT,
    "startedAt" DATETIME,
    "finishingAt" DATETIME,
    "finishedAt" DATETIME,
    "syncedAt" DATETIME,
    "cuVersion" TEXT,
    "cuFuelMode" BOOLEAN,
    "cuRealMode" BOOLEAN,
    "cuPitLane" BOOLEAN,
    "cuLapCounter" BOOLEAN,
    "cuNumCars" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Session_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionDriver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "driverId" TEXT,
    "carId" TEXT,
    "controller" INTEGER NOT NULL,
    "position" INTEGER,
    "gridPos" INTEGER,
    "finalPos" INTEGER,
    "lapsAtFinishing" INTEGER,
    "totalLaps" INTEGER NOT NULL DEFAULT 0,
    "totalTime" INTEGER NOT NULL DEFAULT 0,
    "bestLapTime" INTEGER,
    "lastLapTime" INTEGER,
    "isDNF" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SessionDriver_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SessionDriver_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SessionDriver_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "img" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "img" TEXT,
    "layout" TEXT,
    "length" REAL,
    "corners" INTEGER,
    "color" TEXT NOT NULL DEFAULT '#9333ea',
    "bestLap" REAL,
    "bestLapBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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

-- CreateIndex
CREATE UNIQUE INDEX "ControllerConfig_trackId_controller_key" ON "ControllerConfig"("trackId", "controller");

-- CreateIndex
CREATE UNIQUE INDEX "Device_address_key" ON "Device"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_number_key" ON "Driver"("number");

-- CreateIndex
CREATE INDEX "Lap_sessionId_driverId_idx" ON "Lap"("sessionId", "driverId");

-- CreateIndex
CREATE INDEX "Lap_sessionId_lapTime_idx" ON "Lap"("sessionId", "lapTime");

-- CreateIndex
CREATE INDEX "Lap_sessionId_phase_idx" ON "Lap"("sessionId", "phase");

-- CreateIndex
CREATE INDEX "Lap_sessionId_softDeletedAt_idx" ON "Lap"("sessionId", "softDeletedAt");

-- CreateIndex
CREATE INDEX "Lap_trackId_driverId_lapTime_idx" ON "Lap"("trackId", "driverId", "lapTime");

-- CreateIndex
CREATE UNIQUE INDEX "SessionDriver_sessionId_controller_key" ON "SessionDriver"("sessionId", "controller");

-- CreateIndex
CREATE UNIQUE INDEX "TrackRecord_trackId_driverId_carId_key" ON "TrackRecord"("trackId", "driverId", "carId");
