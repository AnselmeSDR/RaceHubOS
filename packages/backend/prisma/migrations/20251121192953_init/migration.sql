-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "photo" TEXT,
    "color" TEXT NOT NULL,
    "team" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Car" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "photo" TEXT,
    "maxSpeed" INTEGER NOT NULL DEFAULT 100,
    "braking" INTEGER NOT NULL DEFAULT 50,
    "fuelCapacity" INTEGER NOT NULL DEFAULT 100
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "config" TEXT,
    "length" REAL
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "lapsCount" INTEGER,
    "duration" INTEGER,
    "fuelEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trackId" TEXT,
    "championshipId" TEXT,
    CONSTRAINT "Race_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Race_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RaceResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "position" INTEGER NOT NULL,
    "laps" INTEGER NOT NULL,
    "totalTime" REAL NOT NULL,
    "bestLap" REAL NOT NULL,
    "pitStops" INTEGER NOT NULL DEFAULT 0,
    "driverId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    CONSTRAINT "RaceResult_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RaceResult_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RaceResult_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LapTime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lapNumber" INTEGER NOT NULL,
    "time" REAL NOT NULL,
    "resultId" TEXT NOT NULL,
    CONSTRAINT "LapTime_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "RaceResult" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Championship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "pointsSystem" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "DriverStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "racesCount" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "bestLapEver" REAL,
    "driverId" TEXT NOT NULL,
    CONSTRAINT "DriverStats_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverStats_driverId_key" ON "DriverStats"("driverId");
