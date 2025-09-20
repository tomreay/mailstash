import { GmailClient } from './gmail-client';
import { ImapClient } from './imap-client';
import { EmailStorage } from '@/lib/storage/email-storage';
import { EmailAccount } from '@/types/email';
import { db } from '@/lib/db';
import { JobStatusService, SyncCheckpoint } from '@/lib/services/job-status.service';

export class SyncService {
  private storage: EmailStorage;

  constructor() {
    this.storage = new EmailStorage();
  }

  async syncAccount(accountId: string, resumeFromCheckpoint?: SyncCheckpoint): Promise<void> {
    console.log(`Starting sync for account ${accountId}`);

    // Record sync start
    await JobStatusService.recordStart(accountId, 'sync');

    try {
      const account = await db.emailAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      if (account.provider === 'gmail') {
        await this.syncGmailAccount(account, resumeFromCheckpoint);
      } else if (account.provider === 'imap') {
        await this.syncImapAccount(account);
      } else {
        throw new Error(`Unsupported provider: ${account.provider}`);
      }

      // Record successful sync
      await JobStatusService.recordSuccess(accountId, 'sync', {
        fullSync: true,
      });

      console.log(`Sync completed for account ${accountId}`);
    } catch (error) {
      console.error(`Sync failed for account ${accountId}:`, error);

      // Record sync failure
      await JobStatusService.recordFailure(
        accountId,
        'sync',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  }

  private async syncGmailAccount(
    account: EmailAccount,
    resumeFromCheckpoint?: SyncCheckpoint
  ): Promise<void> {
    const client = new GmailClient(account);

    // Get current history ID for future incremental syncs
    const profile = await client.getProfile();
    const currentHistoryId = profile.historyId;
    console.log(
      `Gmail profile for ${account.email}: historyId=${currentHistoryId}`
    );

    // Sync folders/labels
    const labels = await client.getLabels();
    for (const label of labels) {
      await db.folder.upsert({
        where: {
          accountId_path: {
            accountId: account.id,
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
          accountId: account.id,
          gmailLabelId: label.gmailLabelId,
        },
      });
    }

    // Resume from checkpoint if provided
    let pageToken: string | undefined = resumeFromCheckpoint?.pageToken;
    let totalProcessed = resumeFromCheckpoint?.processedCount || 0;
    const startedAt = resumeFromCheckpoint?.startedAt || new Date();
    const failedMessages: string[] = [];
    const retryStats = {
      totalRetries: 0,
      quotaErrors: 0,
      rateLimitErrors: 0,
    };

    if (resumeFromCheckpoint) {
      console.log(
        `Resuming sync from checkpoint: processed=${totalProcessed}, pageToken=${pageToken}`
      );
    }

    do {
      const result = await client.getMessages(500, pageToken);

      for (const message of result.messages) {
        try {
          // Check if message already exists
          const existingMessage = await db.email.findUnique({
            where: { messageId: message.messageId },
          });

          if (!existingMessage) {
            // Get raw message content for EML storage
            const rawContent = await client.getRawMessage(message.id);

            // Store the email
            await this.storage.storeEmail(message, rawContent, account.id);
          }
        } catch (error) {
          console.error(
            `Failed to process message ${message.id} after retries:`,
            error
          );
          failedMessages.push(message.id);
          // Continue with next message
        }
      }

        totalProcessed += result.messages.length;
        console.log(`Processed ${totalProcessed} messages so far...`);

        // Save checkpoint periodically (every 500 messages)
        if (totalProcessed % 500 === 0 && result.nextPageToken) {
          const checkpoint: SyncCheckpoint = {
            pageToken: result.nextPageToken,
            processedCount: totalProcessed,
            lastProcessedMessageId: result.messages[result.messages.length - 1]?.id,
            startedAt,
          };

          // Store checkpoint in job status metadata with failure tracking
          await JobStatusService.updateMetadata(account.id, 'sync', {
            checkpoint,
            lastCheckpointAt: new Date(),
            failedMessageIds: failedMessages,
            failedCount: failedMessages.length,
            retryStats,
          });
          console.log(
            `Checkpoint saved at ${totalProcessed} messages (${failedMessages.length} failures)`
          );
        }

        pageToken = result.nextPageToken;
    } while (pageToken);

    // Clear checkpoint on successful completion
    await JobStatusService.updateMetadata(account.id, 'sync', {
      checkpoint: null,
      completedAt: new Date(),
      totalProcessed,
      failedMessageIds: failedMessages,
      failedCount: failedMessages.length,
      retryStats,
    });

    if (failedMessages.length > 0) {
      console.warn(
        `Sync completed with ${failedMessages.length} failed messages:`,
        failedMessages
      );
    }

    // Store history ID in _SYNC_STATE folder for future incremental syncs
    await db.folder.upsert({
      where: {
        accountId_path: {
          accountId: account.id,
          path: '_SYNC_STATE',
        },
      },
      update: {
        lastSyncId: currentHistoryId,
      },
      create: {
        name: '_SYNC_STATE',
        path: '_SYNC_STATE',
        accountId: account.id,
        lastSyncId: currentHistoryId,
      },
    });

    console.log(
      `Gmail sync completed. Processed ${totalProcessed} messages, Failed ${failedMessages.length} messages. History ID set to ${currentHistoryId} for incremental syncs`
    );
  }

  private async syncImapAccount(account: EmailAccount): Promise<void> {
    const client = new ImapClient(account);

    try {
      await client.connect();

      // Sync mailboxes
      const mailboxes = await client.getMailboxes();
      for (const mailbox of mailboxes) {
        await db.folder.upsert({
          where: {
            accountId_path: {
              accountId: account.id,
              path: mailbox.path,
            },
          },
          update: {
            name: mailbox.name,
          },
          create: {
            name: mailbox.name,
            path: mailbox.path,
            accountId: account.id,
          },
        });
      }

      // Sync messages from important mailboxes
      const mailboxesToSync = ['INBOX', 'Sent', 'Drafts'];

      for (const mailboxName of mailboxesToSync) {
        const mailbox = mailboxes.find(
          m =>
            m.name.toLowerCase() === mailboxName.toLowerCase() ||
            m.path.toLowerCase().includes(mailboxName.toLowerCase())
        );

        if (mailbox) {
          // Get last sync date for incremental sync
          const jobStatus = await db.jobStatus.findUnique({
            where: {
              accountId_jobType: {
                accountId: account.id,
                jobType: 'sync',
              },
            },
            select: { lastRunAt: true },
          });

          const messages = await client.getMessages(
            mailbox.path,
            100,
            jobStatus?.lastRunAt ||
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
          );

          for (const message of messages) {
            // Check if message already exists
            const existingMessage = await db.email.findUnique({
              where: { messageId: message.messageId },
            });

            if (!existingMessage) {
              // Get raw message content for EML storage
              const rawContent = await client.getRawMessage(
                mailbox.path,
                parseInt(message.id)
              );

              // Store the email
              await this.storage.storeEmail(message, rawContent, account.id);
            }
          }
        }
      }
    } finally {
      await client.disconnect();
    }
  }

}

// Singleton instance
export const syncService = new SyncService();
