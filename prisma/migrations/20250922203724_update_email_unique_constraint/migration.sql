/*
  Warnings:

  - A unique constraint covering the columns `[accountId,messageId]` on the table `emails` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."emails_messageId_key";

-- CreateIndex
CREATE UNIQUE INDEX "emails_accountId_messageId_key" ON "public"."emails"("accountId", "messageId");
