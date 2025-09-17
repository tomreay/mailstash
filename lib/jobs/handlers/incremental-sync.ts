import { Task } from 'graphile-worker';
import {
  EmailAccountWithSyncStatus,
  IncrementalSyncPayload,
  JobResult,
} from '../types';
import { ImapClient } from '@/lib/email/imap-client';
import { GmailClient } from '@/lib/email/gmail-client';
import { EmailStorage } from '@/lib/storage/email-storage';
import { db } from '@/lib/db';
import { SyncJob } from '@/types';
import parser from 'cron-parser';

export const incrementalSyncHandler: Task = async (payload, helpers) => {
  let syncJob: SyncJob | null = null;
  const { accountId, lastSyncAt, gmailHistoryId, imapUidValidity } =
    payload as IncrementalSyncPayload;

  console.log(
    `[incremental-sync] Starting incremental sync for account ${accountId}`,
    {
      lastSyncAt,
      gmailHistoryId,
      imapUidValidity,
    }
  );

  try {
    // Create sync job record
    syncJob = await db.syncJob.create({
      data: {
        type: 'incremental_sync',
        status: 'processing',
        accountId,
        startedAt: new Date(),
      },
    });
    const account: EmailAccountWithSyncStatus | null =
      await db.emailAccount.findUnique({
        where: { id: accountId },
        include: { syncStatus: true },
      });

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    if (!account.isActive) {
      console.log(
        `[incremental-sync] Account ${accountId} is not active, skipping sync`
      );
      return;
    }

    const storage = new EmailStorage();
    let result: JobResult = { success: true, emailsProcessed: 0 };

    if (account.provider === 'gmail') {
      result = await syncGmailIncremental(account);
    } else if (account.provider === 'imap') {
      result = await syncImapIncremental(account, storage);
    } else {
      throw new Error(`Unsupported provider: ${account.provider}`);
    }

    // Update sync status
    await db.syncStatus.update({
      where: { accountId },
      data: {
        syncStatus: 'idle',
        lastSyncAt: new Date(),
        errorMessage: null,
        gmailHistoryId:
          result.nextSyncData?.gmailHistoryId ||
          account.syncStatus?.gmailHistoryId,
      },
    });

    // Update job status to completed
    await db.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        emailsProcessed: result.emailsProcessed || 0,
      },
    });

    console.log(
      `[incremental-sync] Incremental sync completed for account ${accountId}`,
      result
    );

    // Get account settings to determine sync frequency
    const accountSettings = await db.emailAccountSettings.findUnique({
      where: { accountId },
    });

    if (accountSettings === null) {
        throw new Error('[incremental-sync] Account settings not found');
    }

    // Only schedule next sync if not paused and not manual
    if (!accountSettings?.syncPaused && accountSettings?.syncFrequency !== 'manual') {
      const nextSyncDelay = getNextSyncDelay(
        result.emailsProcessed || 0,
        accountSettings.syncFrequency
      );
      await helpers.addJob(
        'email:incremental_sync',
        {
          accountId,
          gmailHistoryId: result.nextSyncData?.gmailHistoryId,
          lastSyncAt: new Date().toISOString(),
        },
        { runAt: new Date(Date.now() + nextSyncDelay) }
      );
    } else {
      console.log(
        `[incremental-sync] Not scheduling next sync - sync is ${accountSettings?.syncPaused ? 'paused' : 'manual'} for account ${accountId}`
      );
    }

    // Schedule auto-delete processing if enabled (reuse accountSettings from above)
    if (accountSettings.autoDeleteMode && accountSettings.autoDeleteMode !== 'off') {
      // Fetch autoDeleteMode if not already fetched
      const settings = await db.emailAccountSettings.findUnique({
        where: { accountId },
        select: { autoDeleteMode: true },
      });
      if (settings && settings.autoDeleteMode !== 'off') {
        await helpers.addJob(
          'email:auto_delete',
          { accountId },
          {
            runAt: new Date(Date.now() + 60000), // Run 1 minute after sync
            priority: -1, // Lower priority than sync jobs
          }
        );
        console.log(
          `[incremental-sync] Scheduled auto-delete for account ${accountId}`
        );
      }
    }

  } catch (error) {
    console.error(
      `[incremental-sync] Incremental sync failed for account ${accountId}`,
      error
    );

    // Update job status to failed
    if (syncJob) {
      await db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
    }

    // Check if it's a history gap error (Gmail specific)
    if (error instanceof Error && error.message.includes('history')) {
      console.log(
        '[incremental-sync] History gap detected, scheduling full sync'
      );
      await helpers.addJob('email:full_sync', { accountId }, { priority: 10 });
      return;
    }

    // Let graphile-worker handle retries for transient errors
    throw error;
  }
};

async function syncGmailIncremental(
  account: EmailAccountWithSyncStatus
): Promise<JobResult> {
  const startHistoryId = account.syncStatus?.gmailHistoryId;

  if (!startHistoryId) {
    console.log(
      '[incremental-sync] No history ID found, falling back to full sync'
    );
    throw new Error('Missing history ID - full sync required');
  }

  console.log(
    `[incremental-sync] Starting Gmail history sync from historyId: ${startHistoryId}`
  );

  const client = new GmailClient(account);
  const storage = new EmailStorage();
  let emailsProcessed = 0;
  let newHistoryId = startHistoryId;

  try {
    // Get history changes since last sync
    const historyResult = await client.getHistory(startHistoryId);
    newHistoryId = historyResult.historyId;

    console.log(
      `[incremental-sync] Found ${historyResult.messagesAdded.length} new messages, ${historyResult.messagesDeleted.length} deleted messages`
    );

    // Process new messages
    for (const messageId of historyResult.messagesAdded) {
      try {
        // Check if we already have this message
        const existingEmail = await db.email.findFirst({
          where: {
            gmailId: messageId,
            accountId: account.id,
          },
        });

        if (!existingEmail) {
          // Fetch full message details
          const message = await client.getMessageDetails(messageId);
          if (message) {
            // Get the raw message for storage
            const rawContent = await client.getRawMessage(messageId);

            // Store the email
            await storage.storeEmail(message, rawContent, account.id);
            emailsProcessed++;
          }
        }
      } catch (error) {
        console.error(
          `[incremental-sync] Error processing message ${messageId}:`,
          error
        );
        // Continue with other messages
      }
    }

    // Process deleted messages
    for (const messageId of historyResult.messagesDeleted) {
      try {
        await db.email.updateMany({
          where: {
            gmailId: messageId,
            accountId: account.id,
          },
          data: {
            isDeleted: true,
            updatedAt: new Date(),
          },
        });
      } catch (error) {
        console.error(
          `[incremental-sync] Error deleting message ${messageId}:`,
          error
        );
      }
    }

    // Process label changes
    for (const [messageId, labels] of historyResult.labelsAdded) {
      try {
        const email = await db.email.findFirst({
          where: {
            gmailId: messageId,
            accountId: account.id,
          },
        });

        if (email) {
          // Update email flags based on labels
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
        console.error(
          `[incremental-sync] Error updating labels for message ${messageId}:`,
          error
        );
      }
    }

    // Process removed labels
    for (const [messageId, labels] of historyResult.labelsRemoved) {
      try {
        const email = await db.email.findFirst({
          where: {
            gmailId: messageId,
            accountId: account.id,
          },
        });

        if (email) {
          // Update email flags based on removed labels
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
        console.error(
          `[incremental-sync] Error removing labels for message ${messageId}:`,
          error
        );
      }
    }

    return {
      success: true,
      emailsProcessed,
      nextSyncData: {
        gmailHistoryId: newHistoryId,
      },
    };
  } catch (error) {
    // Check if it's a history gap error
    if (
      error instanceof Error &&
      (error.message.includes('Invalid history id') ||
        error.message.includes('historyId') ||
        ('code' in error && (error as Error & { code: number }).code === 404))
    ) {
      console.log(
        '[incremental-sync] History gap detected, falling back to full sync'
      );
      throw new Error('History gap detected - full sync required');
    }
    throw error;
  }
}

async function syncImapIncremental(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any,
  storage: EmailStorage
): Promise<JobResult> {
  const client = new ImapClient(account);
  let emailsProcessed = 0;

  try {
    await client.connect();

    // Sync important folders
    const foldersToSync = ['INBOX', 'Sent', 'Drafts'];

    for (const folderName of foldersToSync) {
      const folder = await db.folder.findFirst({
        where: {
          accountId: account.id,
          path: { contains: folderName, mode: 'insensitive' },
        },
      });

      if (!folder) continue;

      console.log(`[incremental-sync] Syncing IMAP folder ${folder.path}`);

      // Use a combination of UID and date-based sync for efficiency
      const lastSyncDate =
        account.syncStatus?.lastSyncAt ||
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      // Get messages since last sync date
      const messages = await client.getMessages(folder.path, 500, lastSyncDate); // Increased limit for incremental

      console.log(
        `[incremental-sync] Found ${messages.length} messages in ${folder.path} since ${lastSyncDate.toISOString()}`
      );

      // Process messages efficiently
      const messageIds = messages.map(m => m.messageId);
      const existingMessages = await db.email.findMany({
        where: {
          messageId: { in: messageIds },
          accountId: account.id,
        },
        select: { messageId: true },
      });

      const existingMessageIds = new Set(
        existingMessages.map(m => m.messageId)
      );

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
            console.error(
              `[incremental-sync] Error storing message ${message.messageId}:`,
              error
            );
            // Continue with other messages
          }
        } else {
          // Update flags for existing messages
          await db.email.updateMany({
            where: {
              messageId: message.messageId,
              accountId: account.id,
            },
            data: {
              isRead: message.isRead,
              isImportant: message.isImportant,
              isDeleted: message.isDeleted,
              updatedAt: new Date(),
            },
          });
        }
      }

      // Update folder's last UID for future reference
      const lastUid =
        messages.length > 0
          ? messages[messages.length - 1].id
          : folder.lastImapUid;
      if (lastUid) {
        await db.folder.update({
          where: { id: folder.id },
          data: { lastImapUid: lastUid },
        });
      }
    }
  } finally {
    await client.disconnect();
  }

  return {
    success: true,
    emailsProcessed,
  };
}

function getNextSyncDelay(emailsProcessed: number, syncFrequency: string): number {
  // Parse cron expression to determine next run time
  try {
    const interval = parser.parse(syncFrequency);
    const nextDate = interval.next().toDate();
    const delay = nextDate.getTime() - Date.now();

    // If the delay is too short (less than 1 minute), use minimum delay
    // This can happen if the cron expression runs very frequently
    const MIN_DELAY = 60 * 1000; // 1 minute
    return Math.max(delay, MIN_DELAY);
  } catch (error) {
    console.error(
      `[incremental-sync] Error parsing cron expression '${syncFrequency}', falling back to adaptive intervals`,
      error
    );
    // Fall back to adaptive intervals
    if (emailsProcessed > 10) {
      return 5 * 60 * 1000;
    } else if (emailsProcessed > 0) {
      return 15 * 60 * 1000;
    } else {
      return 30 * 60 * 1000;
    }
  }
}
