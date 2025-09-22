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

    console.log(`Sync completed for account ${accountId}`);
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
      // Get list of message IDs
      const listResponse = await client.getMessagesList(500, pageToken);
      const messageIds = listResponse.messages?.map(msg => msg.id!).filter(id => id) || [];

      if (messageIds.length > 0) {
        // Use batch API to fetch message details
        const batchResult = await client.getMessagesBatch(messageIds);

        // Process successful messages
        for (const message of batchResult.messages) {
          try {
            // Check if message already exists for this account
            const existingMessage = await db.email.findFirst({
              where: {
                messageId: message.messageId,
                accountId: account.id
              },
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

            // Log to database
            await db.failedSyncMessage.create({
              data: {
                accountId: account.id,
                messageId: message.id,
                failureReason: error instanceof Error ? error.message : 'Unknown error during storage',
              },
            }).catch(dbError => {
              console.error('Failed to log failure to database:', dbError);
            });
          }
        }

        // Log batch API failures to database
        for (const failure of batchResult.failures) {
          failedMessages.push(failure.messageId);

          await db.failedSyncMessage.create({
            data: {
              accountId: account.id,
              messageId: failure.messageId,
              failureReason: failure.error,
            },
          }).catch(dbError => {
            console.error('Failed to log failure to database:', dbError);
          });
        }

        totalProcessed += messageIds.length;

        // Save checkpoint periodically (every 500 messages)
        if (totalProcessed % 500 === 0 && listResponse.nextPageToken) {
          const checkpoint: SyncCheckpoint = {
            pageToken: listResponse.nextPageToken,
            processedCount: totalProcessed,
            lastProcessedMessageId: messageIds[messageIds.length - 1],
            startedAt,
          };

          // Store checkpoint in job status metadata with failure tracking
          await JobStatusService.updateMetadata(account.id, 'full_sync', {
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
      }

      pageToken = listResponse.nextPageToken || undefined;
    } while (pageToken);

    // Update metadata on completion (keep the stats, just clear checkpoint)
    await JobStatusService.updateMetadata(account.id, 'full_sync', {
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
    let totalProcessed = 0;
    const failedMessages: string[] = [];

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
                jobType: 'full_sync',
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
            try {
              // Check if message already exists for this account
              const existingMessage = await db.email.findFirst({
                where: {
                  messageId: message.messageId,
                  accountId: account.id
                },
              });

              if (!existingMessage) {
                // Get raw message content for EML storage
                const rawContent = await client.getRawMessage(
                  mailbox.path,
                  parseInt(message.id)
                );

                // Store the email
                await this.storage.storeEmail(message, rawContent, account.id);
                totalProcessed++;
              }
            } catch (error) {
              console.error(
                `Failed to process IMAP message ${message.id}:`,
                error
              );
              failedMessages.push(message.id);
              // Continue with next message
            }
          }
        }
      }

      // Update metadata with results
      await JobStatusService.updateMetadata(account.id, 'full_sync', {
        completedAt: new Date(),
        totalProcessed,
        failedMessageIds: failedMessages,
        failedCount: failedMessages.length,
      });

      if (failedMessages.length > 0) {
        console.warn(
          `IMAP sync completed with ${failedMessages.length} failed messages:`,
          failedMessages
        );
      }

      console.log(
        `IMAP sync completed. Processed ${totalProcessed} messages, Failed ${failedMessages.length} messages`
      );
    } finally {
      await client.disconnect();
    }
  }

}

// Singleton instance
export const syncService = new SyncService();
