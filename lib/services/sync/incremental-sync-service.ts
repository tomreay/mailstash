import {EmailAccount, EmailMessage} from '@/types/email';
import { createEmailClient, isGmailClient, isImapClient } from '@/lib/email/client-factory';
import { GmailClient } from '@/lib/email/gmail-client';
import { ImapClient } from '@/lib/email/imap-client';
import { EmailStorage } from '@/lib/storage/email-storage';
import { db } from '@/lib/db';
import { JOB_CONFIG } from '@/lib/jobs/config';
import { isHistoryGapError } from '@/lib/jobs/utils/error-utils';
import updateSyncState from "@/lib/services/sync/sync-state";

export type IncrementalSyncResult = {
  success: boolean;
  emailsProcessed: number;
  historyId?: string;
  requiresFullSync?: boolean;
  failedMessages?: string[];
};

export type SyncDependencies = {
  storage?: EmailStorage;
  logger?: Console;
};

const defaultDeps: SyncDependencies = {
  storage: new EmailStorage(),
  logger: console,
};

export async function performIncrementalSync(
  account: EmailAccount,
  deps: SyncDependencies = {}
): Promise<IncrementalSyncResult> {
  const { storage, logger } = { ...defaultDeps, ...deps };
  const client = createEmailClient(account);

  logger?.log(`[incremental-sync] Starting sync for account ${account.id} (${account.provider})`);

  if (isGmailClient(client)) {
    return syncGmailIncremental(client, account, storage!, logger);
  } else if (isImapClient(client)) {
    return syncImapIncremental(client, account, storage!, logger);
  }

  throw new Error(`Unsupported provider: ${account.provider}`);
}

async function syncGmailIncremental(
  client: GmailClient,
  account: EmailAccount,
  storage: EmailStorage,
  logger?: Console
): Promise<IncrementalSyncResult> {
  // Get history ID from _SYNC_STATE folder
  const syncFolder = await db.folder.findFirst({
    where: {
      accountId: account.id,
      path: '_SYNC_STATE',
    },
  });

  const startHistoryId = syncFolder?.lastSyncId;

  if (!startHistoryId) {
    logger?.log('[incremental-sync] No history ID found, full sync required');
    return {
      success: false,
      emailsProcessed: 0,
      requiresFullSync: true,
    };
  }

  logger?.log(`[incremental-sync] Starting Gmail history sync from historyId: ${startHistoryId}`);

  let emailsProcessed = 0;
  let newHistoryId = startHistoryId;
  const failedMessages: string[] = [];

  try {
    // Get history changes since last sync
    const historyResult = await client.getHistory(startHistoryId);
    newHistoryId = historyResult.historyId;

    logger?.log(
      `[incremental-sync] Found ${historyResult.messagesAdded.length} new messages, ` +
      `${historyResult.messagesDeleted.length} deleted messages`
    );

    // Process new messages
    for (const messageId of historyResult.messagesAdded) {
      try {
        const existingEmail = await db.email.findFirst({
          where: {
            gmailId: messageId,
            accountId: account.id,
          },
        });

        if (!existingEmail) {
          const message = await client.getMessageDetails(messageId);
          if (message) {
            const rawContent = await client.getRawMessage(messageId);
            await storage.storeEmail(message, rawContent, account.id);
            emailsProcessed++;
          }
          // If message is null, it means no payload - legitimate case, skip silently
        }
      } catch (error) {
        logger?.error(`[incremental-sync] Failed to process message ${messageId}:`, error);
        failedMessages.push(messageId);
        await logFailedMessage(account.id, messageId, error);
      }
    }

    // Process deleted messages
    await processDeletedMessages(historyResult.messagesDeleted, account.id);

    // Process label changes
    await processLabelChanges(
      historyResult.labelsAdded,
      historyResult.labelsRemoved,
      account.id
    );

    // Update history ID
    await updateSyncState(account.id, newHistoryId);

    if (failedMessages.length > 0) {
      logger?.warn(
        `[incremental-sync] Completed with ${failedMessages.length} failed messages`
      );
    }

    return {
      success: true,
      emailsProcessed,
      historyId: newHistoryId,
      failedMessages: failedMessages.length > 0 ? failedMessages : undefined,
    };
  } catch (error) {
    // Check if it's a history gap error
    if (error instanceof Error && isHistoryGapError(error)) {
      logger?.log('[incremental-sync] History gap detected, full sync required');
      return {
        success: false,
        emailsProcessed: 0,
        requiresFullSync: true,
      };
    }
    throw error;
  }
}

async function syncImapIncremental(
  client: ImapClient,
  account: EmailAccount,
  storage: EmailStorage,
  logger?: Console
): Promise<IncrementalSyncResult> {
  let emailsProcessed = 0;
  const failedMessages: string[] = [];

  try {
    await client.connect();

    // Get IMAP folders
    const folders = await db.folder.findMany({
      where: {
        accountId: account.id,
        NOT: { path: '_SYNC_STATE' },
      },
    });

    const lastSyncDate = new Date(Date.now() - JOB_CONFIG.imap.incrementalSyncDays * 24 * 60 * 60 * 1000);

    for (const folder of folders) {
      if (!folder) continue;

      logger?.log(`[incremental-sync] Syncing IMAP folder ${folder.path}`);

      // Get messages since last sync
      const messages = await client.getMessages(
        folder.path,
        JOB_CONFIG.imap.batchSize,
        lastSyncDate
      );

      logger?.log(
        `[incremental-sync] Found ${messages.length} messages in ${folder.path} ` +
        `since ${lastSyncDate.toISOString()}`
      );

      // Check existing messages in batch
      const messageIds = messages.map(m => m.messageId);
      const existingMessages = await db.email.findMany({
        where: {
          messageId: { in: messageIds },
          accountId: account.id,
        },
        select: { messageId: true },
      });

      const existingMessageIds = new Set(existingMessages.map(m => m.messageId));

      // Process new messages
      for (const message of messages) {
        if (!existingMessageIds.has(message.messageId)) {
          try {
            const rawContent = await client.getRawMessage(
              folder.path,
              parseInt(message.id)
            );
            await storage.storeEmail(message, rawContent, account.id);
            emailsProcessed++;
          } catch (error) {
            logger?.error(`[incremental-sync] Error storing message ${message.messageId}:`, error);
            failedMessages.push(message.id);
            await logFailedMessage(account.id, message.id, error);
          }
        } else {
          // Update flags for existing messages
          await updateEmailFlags(message, account.id);
        }
      }

      // Update folder's last sync ID
      if (messages.length > 0) {
        const lastUid = messages[messages.length - 1].id;
        await db.folder.update({
          where: { id: folder.id },
          data: { lastSyncId: lastUid },
        });
      }
    }

    if (failedMessages.length > 0) {
      logger?.warn(
        `[incremental-sync] IMAP sync completed with ${failedMessages.length} failed messages`
      );
    }

    return {
      success: true,
      emailsProcessed,
      failedMessages: failedMessages.length > 0 ? failedMessages : undefined,
    };
  } finally {
    await client.disconnect();
  }
}

// Helper functions
async function processDeletedMessages(deletedIds: string[], accountId: string) {
  for (const messageId of deletedIds) {
    try {
      await db.email.updateMany({
        where: {
          gmailId: messageId,
          accountId,
        },
        data: {
          isDeleted: true,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`Error marking message ${messageId} as deleted:`, error);
    }
  }
}

async function processLabelChanges(
  labelsAdded: Map<string, string[]>,
  labelsRemoved: Map<string, string[]>,
  accountId: string
) {
  // Process added labels
  for (const [messageId, labels] of labelsAdded) {
    try {
      const email = await db.email.findFirst({
        where: {
          gmailId: messageId,
          accountId,
        },
      });

      if (email) {
        const updates: Record<string, boolean> = {};
        if (labels.includes('UNREAD')) updates.isRead = false;
        if (labels.includes('IMPORTANT')) updates.isImportant = true;
        if (labels.includes('SPAM')) updates.isSpam = true;
        if (labels.includes('TRASH')) updates.isDeleted = true;
        if (!labels.includes('INBOX')) updates.isArchived = true;

        await db.email.update({
          where: { id: email.id },
          data: {
            ...updates,
            labels: JSON.stringify(labels),
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`Error updating labels for message ${messageId}:`, error);
    }
  }

  // Process removed labels
  for (const [messageId, labels] of labelsRemoved) {
    try {
      const email = await db.email.findFirst({
        where: {
          gmailId: messageId,
          accountId,
        },
      });

      if (email) {
        const updates: Record<string, boolean> = {};
        if (labels.includes('UNREAD')) updates.isRead = true;
        if (labels.includes('IMPORTANT')) updates.isImportant = false;
        if (labels.includes('SPAM')) updates.isSpam = false;
        if (labels.includes('TRASH')) updates.isDeleted = false;
        if (labels.includes('INBOX')) updates.isArchived = true;

        await db.email.update({
          where: { id: email.id },
          data: {
            ...updates,
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`Error removing labels for message ${messageId}:`, error);
    }
  }
}

async function updateEmailFlags(message: EmailMessage, accountId: string) {
  await db.email.updateMany({
    where: {
      messageId: message.messageId,
      accountId,
    },
    data: {
      isRead: message.isRead,
      isImportant: message.isImportant,
      isDeleted: message.isDeleted,
      updatedAt: new Date(),
    },
  });
}

async function logFailedMessage(accountId: string, messageId: string, error: unknown) {
  try {
    await db.failedSyncMessage.create({
      data: {
        accountId,
        messageId,
        failureReason: error instanceof Error ? error.message : String(error),
      },
    });
  } catch (dbError) {
    console.error('Failed to log failure to database:', dbError);
  }
}