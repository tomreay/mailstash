-- AlterTable
ALTER TABLE "email_account_settings" ADD COLUMN     "currentDryRunJobId" TEXT;

-- AlterTable
ALTER TABLE "sync_jobs" ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE INDEX "sync_jobs_accountId_type_createdAt_idx" ON "sync_jobs"("accountId", "type", "createdAt");
