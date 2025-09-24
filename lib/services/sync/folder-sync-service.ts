import { EmailAccount } from '@/types/email';
import { Folder } from '@/types';
import { createEmailClient, isGmailClient, isImapClient } from '@/lib/email/client-factory';
import { GmailClient } from '@/lib/email/gmail-client';
import { ImapClient } from '@/lib/email/imap-client';
import { EmailStorage } from '@/lib/storage/email-storage';
import { db } from '@/lib/db';
import { JOB_CONFIG } from '@/lib/jobs/config';

export type FolderSyncResult = {
  success: boolean;
  emailsProcessed: number;
  lastSyncId?: string;
};

export type SyncDependencies = {
  storage?: EmailStorage;
  logger?: Console;
};

const defaultDeps: SyncDependencies = {
  storage: new EmailStorage(),
  logger: console,
};

export async function performFolderSync(
  account: EmailAccount,
  folder: Folder,
  deps: SyncDependencies = {}
): Promise<FolderSyncResult> {
  const { storage, logger } = { ...defaultDeps, ...deps };
  const client = createEmailClient(account);

  logger?.log(`[folder-sync] Starting sync for folder ${folder.path} in account ${account.id}`);

  if (isGmailClient(client)) {
    return syncGmailFolder(client, account, folder, storage!, logger);
  } else if (isImapClient(client)) {
    return syncImapFolder(client, account, folder, storage!, logger);
  }

  throw new Error(`Unsupported provider: ${account.provider}`);
}

async function syncGmailFolder(
  client: GmailClient,
  account: EmailAccount,
  folder: Folder,
  storage: EmailStorage,
  logger?: Console
): Promise<FolderSyncResult> {
  let emailsProcessed = 0;
  let pageToken: string | undefined = undefined;
  const maxEmails = JOB_CONFIG.gmail.batchSize; // Limit per job run

  do {
    const result = await client.getMessages(JOB_CONFIG.gmail.batchSize, pageToken);

    for (const message of result.messages) {
      // Check if message already exists
      const existingMessage = await db.email.findUnique({
        where: {
          accountId_messageId: {
            messageId: message.messageId,
            accountId: account.id,
          },
        },
      });

      if (!existingMessage) {
        const rawContent = await client.getRawMessage(message.id);
        await storage.storeEmail(message, rawContent, account.id);
        emailsProcessed++;
      } else if (existingMessage.folderId !== folder.id) {
        // Update folder association if needed
        await db.email.update({
          where: { id: existingMessage.id },
          data: { folderId: folder.id },
        });
      }

      // Log progress periodically
      if (emailsProcessed % 10 === 0) {
        logger?.log(`[folder-sync] Progress: ${emailsProcessed} emails processed`);
      }
    }

    pageToken = result.nextPageToken;
  } while (pageToken && emailsProcessed < maxEmails);

  logger?.log(`[folder-sync] Gmail folder sync completed. Processed ${emailsProcessed} emails`);

  return {
    success: true,
    emailsProcessed,
  };
}

async function syncImapFolder(
  client: ImapClient,
  account: EmailAccount,
  folder: Folder,
  storage: EmailStorage,
  logger?: Console
): Promise<FolderSyncResult> {
  let emailsProcessed = 0;

  try {
    await client.connect();

    logger?.log(`[folder-sync] Syncing IMAP folder ${folder.path}`);

    // Get messages since last sync or default period
    const messages = await client.getMessages(
      folder.path,
      JOB_CONFIG.imap.batchSize
    );

    for (const message of messages) {
      const existingMessage = await db.email.findUnique({
        where: {
          accountId_messageId: {
            messageId: message.messageId,
            accountId: account.id,
          },
        },
      });

      if (!existingMessage) {
        const rawContent = await client.getRawMessage(
          folder.path,
          parseInt(message.id)
        );
        await storage.storeEmail(message, rawContent, account.id);
        emailsProcessed++;
      }

      // Log progress
      if (emailsProcessed % 10 === 0) {
        logger?.log(`[folder-sync] Progress: ${emailsProcessed} emails processed`);
      }
    }

    // Get the highest UID from synced messages
    const lastUid =
      messages.length > 0
        ? Math.max(...messages.map(m => parseInt(m.id)))
        : (folder.lastSyncId ? parseInt(folder.lastSyncId) : null);

    logger?.log(`[folder-sync] IMAP folder sync completed. Processed ${emailsProcessed} emails`);

    return {
      success: true,
      emailsProcessed,
      lastSyncId: lastUid?.toString(),
    };
  } finally {
    await client.disconnect();
  }
}