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
    "teamId" TEXT,
    "totalRaces" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "bestLap" REAL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "number" INTEGER,
    "preferredCarId" TEXT,
    CONSTRAINT "Driver_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Driver_preferredCarId_fkey" FOREIGN KEY ("preferredCarId") REFERENCES "Car" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Driver" ("bestLap", "color", "createdAt", "deletedAt", "email", "id", "img", "isReference", "name", "number", "podiums", "teamId", "totalRaces", "updatedAt", "wins") SELECT "bestLap", "color", "createdAt", "deletedAt", "email", "id", "img", "isReference", "name", "number", "podiums", "teamId", "totalRaces", "updatedAt", "wins" FROM "Driver";
DROP TABLE "Driver";
ALTER TABLE "new_Driver" RENAME TO "Driver";
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");
CREATE UNIQUE INDEX "Driver_number_key" ON "Driver"("number");
CREATE TABLE "new_ChampionshipParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championshipId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "carId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChampionshipParticipant_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChampionshipParticipant_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChampionshipParticipant_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChampionshipParticipant" ("championshipId", "createdAt", "deletedAt", "driverId", "id", "order") SELECT "championshipId", "createdAt", "deletedAt", "driverId", "id", "order" FROM "ChampionshipParticipant";
DROP TABLE "ChampionshipParticipant";
ALTER TABLE "new_ChampionshipParticipant" RENAME TO "ChampionshipParticipant";
CREATE UNIQUE INDEX "ChampionshipParticipant_championshipId_driverId_key" ON "ChampionshipParticipant"("championshipId", "driverId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
