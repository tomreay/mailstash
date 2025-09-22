-- CreateTable
CREATE TABLE "public"."failed_sync_messages" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "failureReason" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_sync_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "failed_sync_messages_accountId_idx" ON "public"."failed_sync_messages"("accountId");

-- CreateIndex
CREATE INDEX "failed_sync_messages_messageId_idx" ON "public"."failed_sync_messages"("messageId");

-- AddForeignKey
ALTER TABLE "public"."failed_sync_messages" ADD CONSTRAINT "failed_sync_messages_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
