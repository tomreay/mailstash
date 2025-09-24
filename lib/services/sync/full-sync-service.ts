import {EmailAccount, EmailFolder} from '@/types/email';
import { createEmailClient, isGmailClient, isImapClient } from '@/lib/email/client-factory';
import { GmailClient } from '@/lib/email/gmail-client';
import { ImapClient } from '@/lib/email/imap-client';
import { EmailStorage } from '@/lib/storage/email-storage';
import { db } from '@/lib/db';
import { SyncCheckpoint } from '@/lib/services/job-status.service';
import { JOB_CONFIG } from '@/lib/jobs/config';
import updateSyncState from "@/lib/services/sync/sync-state";

export type FullSyncResult = {
  success: boolean;
  emailsProcessed: number;
  historyId?: string;
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

export async function performFullSync(
  account: EmailAccount,
  checkpoint?: SyncCheckpoint,
  deps: SyncDependencies = {}
): Promise<FullSyncResult> {
  const { storage, logger } = { ...defaultDeps, ...deps };
  const client = createEmailClient(account);

  logger?.log(`[full-sync] Starting sync for account ${account.id} (${account.provider})`);

  if (isGmailClient(client)) {
    return syncGmailAccount(client, account, storage!, checkpoint, logger);
  } else if (isImapClient(client)) {
    return syncImapAccount(client, account, storage!, logger);
  }

  throw new Error(`Unsupported provider: ${account.provider}`);
}

async function syncGmailAccount(
  client: GmailClient,
  account: EmailAccount,
  storage: EmailStorage,
  checkpoint?: SyncCheckpoint,
  logger?: Console
): Promise<FullSyncResult> {
  // Get current history ID for future incremental syncs
  const profile = await client.getProfile();
  const currentHistoryId = profile.historyId;

  logger?.log(`Gmail profile for ${account.email}: historyId=${currentHistoryId}`);

  // Sync folders/labels
  await syncGmailLabels(client, account.id);

  // Resume from checkpoint if provided
  let pageToken = checkpoint?.pageToken;
  let totalProcessed = checkpoint?.processedCount || 0;
  const failedMessages: string[] = [];

  if (checkpoint) {
    logger?.log(
      `Resuming sync from checkpoint: processed=${totalProcessed}, pageToken=${pageToken}`
    );
  }

  do {
    // Get list of message IDs
    const listResponse = await client.getMessagesList(JOB_CONFIG.gmail.batchSize, pageToken);
    const messageIds = listResponse.messages?.map(msg => msg.id!).filter(id => id) || [];

    if (messageIds.length > 0) {
      // Use batch API to fetch message details
      const batchResult = await client.getMessagesBatch(messageIds);

      // Process successful messages
      for (const message of batchResult.messages) {
        try {
          const existingMessage = await db.email.findFirst({
            where: {
              messageId: message.messageId,
              accountId: account.id,
            },
          });

          if (!existingMessage) {
            const rawContent = await client.getRawMessage(message.id);
            await storage.storeEmail(message, rawContent, account.id);
          }
        } catch (error) {
          logger?.error(
            `Failed to process message ${message.id}:`,
            error
          );
          failedMessages.push(message.id);

          await logFailedMessage(account.id, message.id, error);
        }
      }

      // Log batch API failures
      for (const failure of batchResult.failures) {
        failedMessages.push(failure.messageId);
        await logFailedMessage(account.id, failure.messageId, failure.error);
      }

      totalProcessed += messageIds.length;

      // Save checkpoint periodically
      if (shouldSaveCheckpoint(totalProcessed, listResponse.nextPageToken)) {
        await saveCheckpoint(account.id, {
          pageToken: listResponse.nextPageToken!,
          processedCount: totalProcessed,
          lastProcessedMessageId: messageIds[messageIds.length - 1],
          startedAt: checkpoint?.startedAt || new Date(),
        });

        logger?.log(
          `Checkpoint saved at ${totalProcessed} messages (${failedMessages.length} failures)`
        );
      }
    }

    pageToken = listResponse.nextPageToken || undefined;
  } while (pageToken);

  // Store history ID for future incremental syncs
  await updateSyncState(account.id, currentHistoryId);

  logger?.log(
    `Gmail sync completed. Processed ${totalProcessed} messages, Failed ${failedMessages.length} messages`
  );

  return {
    success: true,
    emailsProcessed: totalProcessed,
    historyId: currentHistoryId,
    failedMessages: failedMessages.length > 0 ? failedMessages : undefined,
  };
}

async function syncImapAccount(
  client: ImapClient,
  account: EmailAccount,
  storage: EmailStorage,
  logger?: Console
): Promise<FullSyncResult> {
  let totalProcessed = 0;
  const failedMessages: string[] = [];

  try {
    await client.connect();

    // Sync mailboxes
    const mailboxes = await client.getMailboxes();
    await syncImapFolders(mailboxes, account.id);

    // Sync messages from important mailboxes
    const mailboxesToSync = ['INBOX', 'Sent', 'Drafts'];
    const syncDate = new Date(Date.now() - JOB_CONFIG.imap.defaultSyncDays * 24 * 60 * 60 * 1000);

    for (const mailboxName of mailboxesToSync) {
      const mailbox = mailboxes.find(m =>
        m.name.toLowerCase() === mailboxName.toLowerCase() ||
        m.path.toLowerCase().includes(mailboxName.toLowerCase())
      );

      if (!mailbox) continue;

      const messages = await client.getMessages(
        mailbox.path,
        JOB_CONFIG.imap.batchSize,
        syncDate
      );

      for (const message of messages) {
        try {
          const existingMessage = await db.email.findFirst({
            where: {
              messageId: message.messageId,
              accountId: account.id,
            },
          });

          if (!existingMessage) {
            const rawContent = await client.getRawMessage(
              mailbox.path,
              parseInt(message.id)
            );
            await storage.storeEmail(message, rawContent, account.id);
            totalProcessed++;
          }
        } catch (error) {
          logger?.error(`Failed to process IMAP message ${message.id}:`, error);
          failedMessages.push(message.id);
        }
      }
    }

    logger?.log(
      `IMAP sync completed. Processed ${totalProcessed} messages, Failed ${failedMessages.length} messages`
    );

    return {
      success: true,
      emailsProcessed: totalProcessed,
      failedMessages: failedMessages.length > 0 ? failedMessages : undefined,
    };
  } finally {
    await client.disconnect();
  }
}

// Helper functions
async function syncGmailLabels(client: GmailClient, accountId: string) {
  const labels = await client.getLabels();

  for (const label of labels) {
    await db.folder.upsert({
      where: {
        accountId_path: {
          accountId,
          path: label.path,
        },
      },
      update: {
        name: label.name,
        gmailLabelId: label.gmailLabelId,
      },
      create: {
        name: label.name,
        path: label.path,
        accountId,
        gmailLabelId: label.gmailLabelId,
      },
    });
  }
}

async function syncImapFolders(mailboxes: EmailFolder[], accountId: string) {
  for (const mailbox of mailboxes) {
    await db.folder.upsert({
      where: {
        accountId_path: {
          accountId,
          path: mailbox.path,
        },
      },
      update: {
        name: mailbox.name,
      },
      create: {
        name: mailbox.name,
        path: mailbox.path,
        accountId,
      },
    });
  }
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

function shouldSaveCheckpoint(processedCount: number, nextPageToken?: string): boolean {
  return processedCount % JOB_CONFIG.thresholds.checkpointInterval === 0 && !!nextPageToken;
}

async function saveCheckpoint(accountId: string, checkpoint: SyncCheckpoint) {
  const { JobStatusService } = await import('@/lib/services/job-status.service');

  await JobStatusService.updateMetadata(accountId, 'full_sync', {
    checkpoint,
    lastCheckpointAt: new Date(),
  });
}