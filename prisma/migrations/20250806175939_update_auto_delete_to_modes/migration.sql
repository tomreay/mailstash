/*
  Warnings:

  - You are about to drop the column `autoDeleteEnabled` on the `email_account_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "email_account_settings" DROP COLUMN "autoDeleteEnabled",
ADD COLUMN     "autoDeleteMode" TEXT NOT NULL DEFAULT 'off';

-- AlterTable
ALTER TABLE "emails" ADD COLUMN     "markedForDeletion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "markedForDeletionAt" TIMESTAMP(3);
