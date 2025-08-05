/*
  Warnings:

  - You are about to drop the column `excludeLabels` on the `email_account_settings` table. All the data in the column will be lost.
  - You are about to drop the column `includeLabels` on the `email_account_settings` table. All the data in the column will be lost.
  - You are about to drop the column `labelFilterMode` on the `email_account_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "email_account_settings" DROP COLUMN "excludeLabels",
DROP COLUMN "includeLabels",
DROP COLUMN "labelFilterMode";
