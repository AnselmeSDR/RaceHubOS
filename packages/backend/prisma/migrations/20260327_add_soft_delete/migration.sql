-- Add deletedAt to all entity tables
ALTER TABLE "Driver" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Car" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Track" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Team" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Championship" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Session" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "SessionDriver" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "TrackRecord" ADD COLUMN "deletedAt" DATETIME;

-- Rename softDeletedAt to deletedAt on Lap
ALTER TABLE "Lap" RENAME COLUMN "softDeletedAt" TO "deletedAt";

-- Drop old index and create new one with renamed column
DROP INDEX IF EXISTS "Lap_sessionId_softDeletedAt_idx";
CREATE INDEX "Lap_sessionId_deletedAt_idx" ON "Lap"("sessionId", "deletedAt");
