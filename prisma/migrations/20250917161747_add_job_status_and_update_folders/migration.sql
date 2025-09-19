-- AlterTable: Add lastSyncId to folders
ALTER TABLE "folders" ADD COLUMN "lastSyncId" TEXT;

-- CreateTable: Create job_status table
CREATE TABLE "job_status" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_status_accountId_jobType_key" ON "job_status"("accountId", "jobType");

-- AddForeignKey
ALTER TABLE "job_status" ADD CONSTRAINT "job_status_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;