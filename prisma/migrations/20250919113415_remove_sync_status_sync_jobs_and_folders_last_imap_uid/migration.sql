/*
  Warnings:

  - You are about to drop the column `lastImapUid` on the `folders` table. All the data in the column will be lost.
  - You are about to drop the `sync_jobs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sync_status` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."sync_status" DROP CONSTRAINT "sync_status_accountId_fkey";

-- AlterTable
ALTER TABLE "public"."folders" DROP COLUMN "lastImapUid";

-- DropTable
DROP TABLE "public"."sync_jobs";

-- DropTable
DROP TABLE "public"."sync_status";

-- CreateIndex
CREATE INDEX "job_status_accountId_idx" ON "public"."job_status"("accountId");
