import { Task } from 'graphile-worker';
import {EmailAccountWithSyncStatus, IncrementalSyncPayload, JobResult} from '../types';
import { GmailClient } from '@/lib/email/gmail-client';
import { ImapClient } from '@/lib/email/imap-client';
import { EmailStorage } from '@/lib/storage/email-storage';
import { db } from '@/lib/db';

export const incrementalSyncHandler: Task = async (
  payload,
  helpers
) => {
  const { accountId, lastSyncAt, gmailHistoryId, imapUidValidity } = payload as IncrementalSyncPayload;
  
  console.log(`[incremental-sync] Starting incremental sync for account ${accountId}`, {
    lastSyncAt,
    gmailHistoryId,
    imapUidValidity,
  });
  
  try {
    const account: EmailAccountWithSyncStatus | null = await db.emailAccount.findUnique({
      where: { id: accountId },
      include: { syncStatus: true },
    });
    
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }
    
    if (!account.isActive) {
      console.log(`[incremental-sync] Account ${accountId} is not active, skipping sync`);
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
        gmailHistoryId: result.nextSyncData?.gmailHistoryId || account.syncStatus?.gmailHistoryId,
      },
    });
    
    console.log(`[incremental-sync] Incremental sync completed for account ${accountId}`, result);
    
    // Schedule next incremental sync based on activity
    const nextSyncDelay = getNextSyncDelay(result.emailsProcessed || 0);
    await helpers.addJob(
      'email:incremental_sync',
      { 
        accountId,
        gmailHistoryId: result.nextSyncData?.gmailHistoryId,
        lastSyncAt: new Date().toISOString(),
      },
      { runAt: new Date(Date.now() + nextSyncDelay) }
    );
    
  } catch (error) {
    console.error(`[incremental-sync] Incremental sync failed for account ${accountId}`, error);
    
    // Check if it's a history gap error (Gmail specific)
    if (error instanceof Error && error.message.includes('history')) {
      console.log('[incremental-sync] History gap detected, scheduling full sync');
      await helpers.addJob('email:full_sync', { accountId }, { priority: 10 });
      return;
    }
    
    // Let graphile-worker handle retries for transient errors
    throw error;
  }
};

async function syncGmailIncremental(
  account: EmailAccountWithSyncStatus,
): Promise<JobResult> {
  const startHistoryId = account.syncStatus?.gmailHistoryId;

  if (!startHistoryId) {
    console.log('[incremental-sync] No history ID found, falling back to full sync');
    throw new Error('Missing history ID - full sync required');
  }

  console.log(`[incremental-sync] Gmail history sync not implemented, falling back to full sync`);

  // TODO: Implement getHistory method in GmailClient
  // For now, throw error to trigger full sync
  throw new Error('Gmail history sync not implemented');
}

async function syncImapIncremental(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any,
  storage: EmailStorage,
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
      
      // Get messages since last sync
      const lastSyncDate = account.syncStatus?.lastSyncAt || 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      const messages = await client.getMessages(folder.path, 100, lastSyncDate);
      
      for (const message of messages) {
        const existingMessage = await db.email.findUnique({
          where: { messageId: message.messageId },
        });
        
        if (!existingMessage) {
          const rawContent = await client.getRawMessage(folder.path, parseInt(message.id));
          await storage.storeEmail(message, rawContent, account.id);
          emailsProcessed++;
        }
      }
      
      // Update folder's last UID
      const lastUid = messages.length > 0 ? messages[messages.length - 1].id : folder.lastImapUid;
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

function getNextSyncDelay(emailsProcessed: number): number {
  // Adaptive sync intervals based on activity
  if (emailsProcessed > 10) {
    return 5 * 60 * 1000; // 5 minutes if high activity
  } else if (emailsProcessed > 0) {
    return 15 * 60 * 1000; // 15 minutes if some activity
  } else {
    return 30 * 60 * 1000; // 30 minutes if no activity
  }
}