/*
  Warnings:

  - You are about to drop the column `isScanned` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `scanResult` on the `attachments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."attachments" DROP COLUMN "isScanned",
DROP COLUMN "scanResult";
