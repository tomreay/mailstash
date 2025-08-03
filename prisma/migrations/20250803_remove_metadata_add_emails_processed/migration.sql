-- AlterTable
ALTER TABLE "sync_jobs" DROP COLUMN "metadata",
ADD COLUMN "emailsProcessed" INTEGER NOT NULL DEFAULT 0;