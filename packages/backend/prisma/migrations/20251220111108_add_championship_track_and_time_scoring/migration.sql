-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Championship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "pointsSystem" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "trackId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Championship_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Championship" ("createdAt", "id", "name", "pointsSystem", "season", "status", "updatedAt") SELECT "createdAt", "id", "name", "pointsSystem", "season", "status", "updatedAt" FROM "Championship";
DROP TABLE "Championship";
ALTER TABLE "new_Championship" RENAME TO "Championship";
CREATE TABLE "new_ChampionshipStanding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championshipId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "qualifBestTime" INTEGER,
    "raceTotalLaps" INTEGER NOT NULL DEFAULT 0,
    "raceTotalTime" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ChampionshipStanding_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChampionshipStanding" ("championshipId", "driverId", "id", "podiums", "points", "position", "wins") SELECT "championshipId", "driverId", "id", "podiums", "points", "position", "wins" FROM "ChampionshipStanding";
DROP TABLE "ChampionshipStanding";
ALTER TABLE "new_ChampionshipStanding" RENAME TO "ChampionshipStanding";
CREATE UNIQUE INDEX "ChampionshipStanding_championshipId_driverId_key" ON "ChampionshipStanding"("championshipId", "driverId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
