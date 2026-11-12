-- Divisions (drivers) and categories (cars) replace the teams: each team becomes a driver division,
-- with its logo, its drivers and its add-on fields. Dates are stored in milliseconds.

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "img" TEXT,
    "scope" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DriverDivision" (
    "driverId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("driverId", "divisionId"),
    CONSTRAINT "DriverDivision_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DriverDivision_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CarDivision" (
    "carId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("carId", "divisionId"),
    CONSTRAINT "CarDivision_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CarDivision_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChampionshipDivision" (
    "championshipId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("championshipId", "divisionId"),
    CONSTRAINT "ChampionshipDivision_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChampionshipDivision_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DivisionExtra" (
    "divisionId" TEXT NOT NULL,
    "addon" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("divisionId", "addon"),
    CONSTRAINT "DivisionExtra_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Teams become driver divisions, ranked by name (the ones in the bin last), same ids
INSERT INTO "Division" ("id", "name", "color", "img", "scope", "order", "deletedAt", "createdAt", "updatedAt")
SELECT "id", "name", COALESCE("color", '#6B7280'), "img", 'driver',
       ROW_NUMBER() OVER (ORDER BY "deletedAt" IS NOT NULL, "name"), "deletedAt", "createdAt", "updatedAt"
FROM "Team";

INSERT INTO "DriverDivision" ("driverId", "divisionId", "createdAt")
SELECT "id", "teamId", CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
FROM "Driver"
WHERE "teamId" IN (SELECT "id" FROM "Team");

INSERT INTO "DivisionExtra" ("divisionId", "addon", "data", "updatedAt")
SELECT "teamId", "addon", "data", "updatedAt" FROM "TeamExtra";

-- Starting data, once: driver divisions when there was no team, car categories always
INSERT INTO "Division" ("id", "name", "color", "scope", "order", "createdAt", "updatedAt")
SELECT v."id", v."name", v."color", 'driver', v."order",
       CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
       CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
FROM (
    SELECT 'division-platinium' AS "id", 'PLATINIUM' AS "name", '#D1F6FF' AS "color", 1 AS "order"
    UNION ALL SELECT 'division-gold', 'GOLD', '#F5D13C', 2
    UNION ALL SELECT 'division-silver', 'SILVER', '#C4C4C4', 3
    UNION ALL SELECT 'division-bronze', 'BRONZE', '#945434', 4
) AS v
WHERE NOT EXISTS (SELECT 1 FROM "Team");

INSERT INTO "Division" ("id", "name", "color", "scope", "order", "createdAt", "updatedAt")
SELECT v."id", v."name", v."color", 'car', v."order",
       CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
       CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
FROM (
    SELECT 'category-gt3' AS "id", 'GT3' AS "name", '#E11D48' AS "color", 1 AS "order"
    UNION ALL SELECT 'category-gte', 'GTE', '#7C3AED', 2
    UNION ALL SELECT 'category-dtm', 'DTM', '#0284C7', 3
    UNION ALL SELECT 'category-formule', 'Formule', '#16A34A', 4
    UNION ALL SELECT 'category-classique', 'Classique', '#EA580C', 5
) AS v;

-- DropIndex
DROP INDEX "TeamExtra_addon_idx";

-- RedefineTables: the driver loses its team
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "img" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "totalRaces" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "bestLap" REAL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "number" INTEGER,
    "preferredCarId" TEXT,
    CONSTRAINT "Driver_preferredCarId_fkey" FOREIGN KEY ("preferredCarId") REFERENCES "Car" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Driver" ("bestLap", "color", "createdAt", "deletedAt", "email", "id", "img", "isReference", "name", "number", "podiums", "preferredCarId", "totalRaces", "updatedAt", "wins") SELECT "bestLap", "color", "createdAt", "deletedAt", "email", "id", "img", "isReference", "name", "number", "podiums", "preferredCarId", "totalRaces", "updatedAt", "wins" FROM "Driver";
DROP TABLE "Driver";
ALTER TABLE "new_Driver" RENAME TO "Driver";
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");
CREATE UNIQUE INDEX "Driver_number_key" ON "Driver"("number");
DROP TABLE "TeamExtra";
DROP TABLE "Team";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DriverDivision_divisionId_idx" ON "DriverDivision"("divisionId");

-- CreateIndex
CREATE INDEX "CarDivision_divisionId_idx" ON "CarDivision"("divisionId");

-- CreateIndex
CREATE INDEX "ChampionshipDivision_divisionId_idx" ON "ChampionshipDivision"("divisionId");

-- CreateIndex
CREATE INDEX "DivisionExtra_addon_idx" ON "DivisionExtra"("addon");
