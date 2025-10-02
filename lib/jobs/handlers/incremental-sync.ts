import { createJobHandler } from '../create-handler';
import { IncrementalSyncPayload } from '../types';
import { performIncrementalSync } from '@/lib/services/sync/incremental-sync-service';
import { scheduleIncrementalSync, scheduleFullSync, scheduleAutoDelete } from '../utils/scheduler';
import { getNextSyncDelay } from '../config';

export const incrementalSyncHandler = createJobHandler<IncrementalSyncPayload>(
  'incremental_sync',
  async ({ account, helpers }) => {
    console.log(`[incremental-sync] Starting incremental sync for account ${account.id}`);

    // Perform the sync
    const result = await performIncrementalSync(account);

    // Check if full sync is required
    if (result.requiresFullSync) {
      console.log('[incremental-sync] History gap detected, scheduling full sync');
      await scheduleFullSync(account.id, helpers);
      return {
        success: false,
        reason: 'History gap - full sync scheduled',
      };
    }

    // Schedule next incremental sync
    const delay = getNextSyncDelay(result.emailsProcessed, account.provider as 'gmail' | 'imap');
    await scheduleIncrementalSync(account.id, helpers, {
      delay,
      historyId: result.historyId,
    });

    // Schedule auto-delete if enabled
    await scheduleAutoDelete(account.id, helpers);

    console.log(
      `[incremental-sync] Incremental sync completed for account ${account.id}. ` +
      `Processed: ${result.emailsProcessed}, Failed: ${result.failedMessages?.length || 0}`
    );

    return {
      emailsProcessed: result.emailsProcessed,
      provider: account.provider,
      historyId: result.historyId,
      failedMessageIds: result.failedMessages,
      failedCount: result.failedMessages?.length || 0,
    };
  }
);