import { Task } from 'graphile-worker';
import {
  IncrementalSyncPayload,
  JobResult,
} from '../types';
import { ImapClient } from '@/lib/email/imap-client';
import { GmailClient } from '@/lib/email/gmail-client';
import { EmailStorage } from '@/lib/storage/email-storage';
import { db } from '@/lib/db';
import { JobStatusService } from '@/lib/services/job-status.service';
import { EmailAccount } from '@/types/email';
import parser from 'cron-parser';

export const incrementalSyncHandler: Task = async (payload, helpers) => {
  const { accountId } = payload as IncrementalSyncPayload;

  console.log(
    `[incremental-sync] Starting incremental sync for account ${accountId}`
  );

  try {
    // Record job start in JobStatus
    await JobStatusService.recordStart(accountId, 'incremental_sync');
    const account = await db.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    if (!account.isActive) {
      console.log(
        `[incremental-sync] Account ${accountId} is not active, skipping sync`
      );
      await JobStatusService.recordSuccess(accountId, 'incremental_sync', {
        skipped: true,
        reason: 'Account inactive',
      });
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

    // Update Gmail history ID if applicable
    if (result.nextSyncData?.gmailHistoryId) {
      await db.folder.update({
        where: {
          accountId_path: {
            accountId,
            path: '_SYNC_STATE',
          },
        },
        data: {
          lastSyncId: result.nextSyncData.gmailHistoryId,
        },
      });
    }

    // Record successful completion in JobStatus
    await JobStatusService.recordSuccess(accountId, 'incremental_sync', {
      emailsProcessed: result.emailsProcessed || 0,
      provider: account.provider,
    });

    console.log(
      `[incremental-sync] Incremental sync completed for account ${accountId}`,
      result
    );

    // Get account settings to determine sync frequency
    const accountSettings = await db.emailAccountSettings.findUnique({
      where: { accountId },
    });

    if (!accountSettings) {
      console.log(
        `[incremental-sync] No settings found for account ${accountId}, using defaults`
      );
    }

    // Only schedule next sync if not paused and not manual
    if (accountSettings && !accountSettings.syncPaused && accountSettings.syncFrequency !== 'manual') {
      const nextSyncDelay = getNextSyncDelay(
        result.emailsProcessed || 0,
        accountSettings.syncFrequency
      );
      await helpers.addJob(
        'email:incremental_sync',
        { accountId },
        {
          runAt: new Date(Date.now() + nextSyncDelay),
          jobKey: `email:incremental_sync:${accountId}`
        }
      );
    } else {
      console.log(
        `[incremental-sync] Not scheduling next sync - sync is ${accountSettings?.syncPaused ? 'paused' : 'manual'} for account ${accountId}`
      );
    }

    // Schedule auto-delete processing if enabled (reuse accountSettings from above)
    if (accountSettings?.autoDeleteMode && accountSettings.autoDeleteMode !== 'off') {
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
            jobKey: `email:auto_delete:${accountId}`
          }
        );
        console.log(
          `[incremental-sync] Scheduled auto-delete for account ${accountId}`
        );
      }
    }

    // Explicitly return to signal successful completion
    return;
  } catch (error) {
    console.error(
      `[incremental-sync] Incremental sync failed for account ${accountId}`,
      error
    );

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isFinalAttempt = helpers.job.attempts >= helpers.job.max_attempts;

    // Record failure in JobStatus
    await JobStatusService.recordFailure(accountId, 'incremental_sync', errorMessage, {
      attempt: helpers.job.attempts,
      maxAttempts: helpers.job.max_attempts,
      isFinal: isFinalAttempt,
    });

    // Check if it's a history gap error (Gmail specific)
    if (error instanceof Error && error.message.includes('history')) {
      console.log(
        '[incremental-sync] History gap detected, scheduling full sync'
      );
      await helpers.addJob('email:full_sync', { accountId }, {
        priority: 10,
        jobKey: `email:full_sync:${accountId}`
      });
      return;
    }

    if (isFinalAttempt) {
      console.log(
        `[incremental-sync] Final attempt failed for account ${accountId}, sync disabled until manual intervention`
      );
    }

    // Let graphile-worker handle retries for transient errors
    throw error;
  }
};

async function syncGmailIncremental(
  account: EmailAccount
): Promise<JobResult> {
  // Get history ID from _SYNC_STATE folder
  const syncFolder = await db.folder.findFirst({
    where: {
      accountId: account.id,
      path: '_SYNC_STATE',
    },
  });
  const startHistoryId = syncFolder?.lastSyncId;

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
  const failedMessages: string[] = [];

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
          `[incremental-sync] Failed to process message ${messageId} after retries:`,
          error
        );
        failedMessages.push(messageId);
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

    // DUAL WRITE: Update new structure (_SYNC_STATE folder)
    if (syncFolder) {
      await db.folder.update({
        where: { id: syncFolder.id },
        data: { lastSyncId: newHistoryId },
      });
    } else {
      // Create _SYNC_STATE folder if it doesn't exist
      await db.folder.create({
        data: {
          accountId: account.id,
          name: '_SYNC_STATE',
          path: '_SYNC_STATE',
          lastSyncId: newHistoryId,
        },
      });
    }

    // Log summary if there were failures
    if (failedMessages.length > 0) {
      console.warn(
        `[incremental-sync] Completed with ${failedMessages.length} failed messages:`,
        failedMessages
      );
      // Store failed messages in metadata
      await JobStatusService.updateMetadata(account.id, 'incremental_sync', {
        lastIncrementalSync: new Date(),
        failedMessageIds: failedMessages,
        failedCount: failedMessages.length,
      });
    }

    return {
      success: true,
      emailsProcessed,
      nextSyncData: {
        gmailHistoryId: newHistoryId,  // For old structure
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
  account: EmailAccount,
  storage: EmailStorage
): Promise<JobResult> {
  const client = new ImapClient(account);
  let emailsProcessed = 0;

  try {
    await client.connect();

    // Get IMAP folders from the database
    const folders = await db.folder.findMany({
      where: {
        accountId: account.id,
        NOT: {
          path: '_SYNC_STATE',
        },
      },
    });

    for (const folder of folders) {

      if (!folder) continue;

      console.log(`[incremental-sync] Syncing IMAP folder ${folder.path}`);

      // Use last UID if available, otherwise use date-based sync
      const lastSyncDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago as fallback

      // Get messages since last sync (by UID if available)
      const messages = await client.getMessages(folder.path, 500, lastSyncDate); // TODO: Use lastUid when IMAP client supports it

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

      // DUAL WRITE: Update new field
      const newLastUid =
        messages.length > 0
          ? messages[messages.length - 1].id
          : folder.lastSyncId;
      if (newLastUid) {
        await db.folder.update({
          where: { id: folder.id },
          data: {
            lastSyncId: newLastUid,    // New field
          },
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
