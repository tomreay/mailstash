import { Task } from 'graphile-worker';
import {
  EmailAccountWithFolders,
  FolderSyncPayload,
  JobResult,
} from '../types';
import { GmailClient } from '@/lib/email/gmail-client';
import { ImapClient } from '@/lib/email/imap-client';
import { EmailStorage } from '@/lib/storage/email-storage';
import { db } from '@/lib/db';
import { Folder } from '@/types';
import { EmailAccount } from '@/types/email';

export const folderSyncHandler: Task = async payload => {
  const { accountId, folderId, folderPath, lastSyncId } =
    payload as FolderSyncPayload;

  console.log(`[folder-sync] Starting folder sync for ${folderPath}`, {
    accountId,
    folderId,
    lastSyncId,
  });

  try {
    const account: EmailAccountWithFolders | null =
      await db.emailAccount.findUnique({
        where: { id: accountId },
        include: { folders: { where: { id: folderId } } },
      });

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    if (!account.isActive) {
      console.log(
        `[folder-sync] Account ${accountId} is not active, skipping sync`
      );
      return;
    }

    const folder = account.folders[0];
    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    const storage = new EmailStorage();
    let result: JobResult = { success: true, emailsProcessed: 0 };

    if (account.provider === 'gmail') {
      result = await syncGmailFolder(account, folder, storage);
    } else if (account.provider === 'imap') {
      result = await syncImapFolder(account, folder, storage);
    } else {
      throw new Error(`Unsupported provider: ${account.provider}`);
    }

    // Update folder sync metadata
    if (result.nextSyncData?.lastSyncId) {
      await db.folder.update({
        where: { id: folderId },
        data: {
          lastSyncId: result.nextSyncData.lastSyncId,
          updatedAt: new Date(),
        },
      });
    }

    console.log(
      `[folder-sync] Folder sync completed for ${folderPath}`,
      result
    );
  } catch (error) {
    console.error(`[folder-sync] Folder sync failed for ${folderPath}`, error);
    throw error;
  }
};

async function syncGmailFolder(
  account: EmailAccount,
  folder: Folder,
  storage: EmailStorage
): Promise<JobResult> {
  const client = new GmailClient(account);
  let emailsProcessed = 0;
  let pageToken: string | undefined = undefined;

  do {
    const result = await client.getMessages(500, pageToken);

    for (const message of result.messages) {
      // Check if message already exists
      const existingMessage = await db.email.findUnique({
        where: { messageId: message.messageId },
      });

      if (!existingMessage) {
        const rawContent = await client.getRawMessage(message.id);
        await storage.storeEmail(message, rawContent, account.id);
        emailsProcessed++;
      } else {
        // Update folder association if needed
        if (existingMessage.folderId !== folder.id) {
          await db.email.update({
            where: { id: existingMessage.id },
            data: { folderId: folder.id },
          });
        }
      }

      // Log progress periodically
      if (emailsProcessed % 10 === 0) {
        console.log(
          `[folder-sync] Progress: ${emailsProcessed} emails processed`
        );
      }
    }

    pageToken = result.nextPageToken;
  } while (pageToken && emailsProcessed < 500); // Limit to 500 emails per job

  return {
    success: true,
    emailsProcessed,
  };
}

async function syncImapFolder(
  account: EmailAccount,
  folder: Folder,
  storage: EmailStorage
): Promise<JobResult> {
  const client = new ImapClient(account);
  let emailsProcessed = 0;

  try {
    await client.connect();

    console.log(`[folder-sync] Syncing IMAP folder ${folder.path}`);

    // Get messages since last sync
    const messages = await client.getMessages(folder.path, 100);

    for (const message of messages) {
      const existingMessage = await db.email.findUnique({
        where: { messageId: message.messageId },
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
        console.log(
          `[folder-sync] Progress: ${emailsProcessed} emails processed`
        );
      }
    }

    // Get the highest UID from synced messages
    const lastUid =
      messages.length > 0
        ? Math.max(...messages.map(m => parseInt(m.id)))
        : (folder.lastSyncId ? parseInt(folder.lastSyncId) : null);

    return {
      success: true,
      emailsProcessed,
      nextSyncData: {
        lastSyncId: lastUid?.toString(),
      },
    };
  } finally {
    await client.disconnect();
  }
}
