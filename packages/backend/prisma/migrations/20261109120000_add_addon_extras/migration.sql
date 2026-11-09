-- CreateTable
CREATE TABLE "DriverExtra" (
    "driverId" TEXT NOT NULL,
    "addon" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("driverId", "addon"),
    CONSTRAINT "DriverExtra_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CarExtra" (
    "carId" TEXT NOT NULL,
    "addon" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("carId", "addon"),
    CONSTRAINT "CarExtra_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackExtra" (
    "trackId" TEXT NOT NULL,
    "addon" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("trackId", "addon"),
    CONSTRAINT "TrackExtra_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamExtra" (
    "teamId" TEXT NOT NULL,
    "addon" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("teamId", "addon"),
    CONSTRAINT "TeamExtra_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChampionshipExtra" (
    "championshipId" TEXT NOT NULL,
    "addon" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("championshipId", "addon"),
    CONSTRAINT "ChampionshipExtra_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionExtra" (
    "sessionId" TEXT NOT NULL,
    "addon" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("sessionId", "addon"),
    CONSTRAINT "SessionExtra_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DriverExtra_addon_idx" ON "DriverExtra"("addon");

-- CreateIndex
CREATE INDEX "CarExtra_addon_idx" ON "CarExtra"("addon");

-- CreateIndex
CREATE INDEX "TrackExtra_addon_idx" ON "TrackExtra"("addon");

-- CreateIndex
CREATE INDEX "TeamExtra_addon_idx" ON "TeamExtra"("addon");

-- CreateIndex
CREATE INDEX "ChampionshipExtra_addon_idx" ON "ChampionshipExtra"("addon");

-- CreateIndex
CREATE INDEX "SessionExtra_addon_idx" ON "SessionExtra"("addon");
