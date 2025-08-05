/*
  Warnings:

  - You are about to drop the `account_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "account_settings" DROP CONSTRAINT "account_settings_accountId_fkey";

-- DropTable
DROP TABLE "account_settings";

-- CreateTable
CREATE TABLE "email_account_settings" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "syncFrequency" TEXT NOT NULL DEFAULT 'manual',
    "syncPaused" BOOLEAN NOT NULL DEFAULT false,
    "includeLabels" TEXT[],
    "excludeLabels" TEXT[],
    "labelFilterMode" TEXT NOT NULL DEFAULT 'all',
    "autoDeleteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deleteDelayHours" INTEGER,
    "deleteAgeMonths" INTEGER,
    "deleteOnlyArchived" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_account_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_account_settings_accountId_key" ON "email_account_settings"("accountId");

-- AddForeignKey
ALTER TABLE "email_account_settings" ADD CONSTRAINT "email_account_settings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
