import { GmailClient } from './gmail-client';
import { ImapClient } from './imap-client';
import { EmailStorage } from '@/lib/storage/email-storage';
import { virusScanner } from '@/lib/security/virus-scanner';
import { EmailAccount } from '@/types/email';
import { db } from '@/lib/db';

export class SyncService {
  private storage: EmailStorage;

  constructor() {
    this.storage = new EmailStorage();
  }

  async syncAccount(accountId: string): Promise<void> {
    console.log(`Starting sync for account ${accountId}`);

    // Update sync status
    await db.syncStatus.upsert({
      where: { accountId },
      update: {
        syncStatus: 'syncing',
        errorMessage: null,
      },
      create: {
        accountId,
        syncStatus: 'syncing',
      },
    });

    try {
      const account = await db.emailAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      if (account.provider === 'gmail') {
        await this.syncGmailAccount(account);
      } else if (account.provider === 'imap') {
        await this.syncImapAccount(account);
      } else {
        throw new Error(`Unsupported provider: ${account.provider}`);
      }

      // Update sync status as successful
      await db.syncStatus.update({
        where: { accountId },
        data: {
          syncStatus: 'idle',
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });

      console.log(`Sync completed for account ${accountId}`);
    } catch (error) {
      console.error(`Sync failed for account ${accountId}:`, error);

      // Update sync status as failed
      await db.syncStatus.update({
        where: { accountId },
        data: {
          syncStatus: 'error',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  private async syncGmailAccount(account: EmailAccount): Promise<void> {
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

    // Sync all messages regardless of label
    let pageToken: string | undefined = undefined;
    let totalProcessed = 0;

    do {
      const result = await client.getMessages(100, pageToken);

      for (const message of result.messages) {
        // Check if message already exists
        const existingMessage = await db.email.findUnique({
          where: { messageId: message.messageId },
        });

        if (!existingMessage) {
          // Get raw message content for EML storage
          const rawContent = await client.getRawMessage(message.id);

          // Store the email
          await this.storage.storeEmail(message, rawContent, account.id);

          // Scan attachments if any
          if (message.hasAttachments) {
            await this.scanEmailAttachments(message.messageId);
          }
        }
      }

      totalProcessed += result.messages.length;
      console.log(`Processed ${totalProcessed} messages so far...`);

      pageToken = result.nextPageToken;
    } while (pageToken);

    // Update sync status with history ID for future incremental syncs
    await db.syncStatus.update({
      where: { accountId: account.id },
      data: {
        gmailHistoryId: currentHistoryId,
      },
    });

    console.log(
      `Gmail sync completed. History ID set to ${currentHistoryId} for incremental syncs`
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
          const lastSync = await db.syncStatus.findUnique({
            where: { accountId: account.id },
            select: { lastSyncAt: true },
          });

          const messages = await client.getMessages(
            mailbox.path,
            100,
            lastSync?.lastSyncAt ||
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

              // Scan attachments if any
              if (message.hasAttachments) {
                await this.scanEmailAttachments(message.messageId);
              }
            }
          }
        }
      }
    } finally {
      await client.disconnect();
    }
  }

  private async scanEmailAttachments(messageId: string): Promise<void> {
    const attachments = await db.attachment.findMany({
      where: {
        email: { messageId },
        isScanned: false,
      },
    });

    for (const attachment of attachments) {
      await virusScanner.scanAttachment(attachment.id, attachment.filePath);
    }
  }
}

// Singleton instance
export const syncService = new SyncService();
