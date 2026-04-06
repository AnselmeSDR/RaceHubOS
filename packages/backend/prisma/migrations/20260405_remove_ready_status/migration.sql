-- Migrate all sessions with 'ready' status to 'draft'
UPDATE "Session" SET "status" = 'draft' WHERE "status" = 'ready';
