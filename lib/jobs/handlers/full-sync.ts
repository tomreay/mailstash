import { createJobHandler } from '../create-handler';
import { FullSyncPayload } from '../types';
import { performFullSync } from '@/lib/services/sync/full-sync-service';
import { scheduleIncrementalSync } from '../utils/scheduler';
import { db } from '@/lib/db';
import {JobStatusService, SyncJobMetadata} from '@/lib/services/job-status.service';

export const fullSyncHandler = createJobHandler<FullSyncPayload>(
  'full_sync',
  async ({ account, helpers }) => {
    console.log(`[full-sync] Starting full sync for account ${account.id}`);

    // Check for existing checkpoint
    const checkpoint = await getCheckpoint(account.id);

    if (checkpoint) {
      console.log('[full-sync] Found existing checkpoint, resuming sync');
    }

    // Perform the sync
    const result = await performFullSync(account, checkpoint);

    // Clear checkpoint on successful completion
    if (result.success) {
      await clearCheckpoint(account.id);
    }

    // Get sync statistics
    const emailCount = await db.email.count({
      where: { accountId: account.id },
    });

    // Schedule next incremental sync
    const syncFolder = await db.folder.findFirst({
      where: {
        accountId: account.id,
        path: '_SYNC_STATE',
      },
      select: { lastSyncId: true },
    });

    await scheduleIncrementalSync(account.id, helpers, {
      delay: 5 * 60 * 1000, // 5 minutes
      historyId: syncFolder?.lastSyncId || result.historyId,
      lastSyncAt: new Date().toISOString(),
    });

    console.log(
      `[full-sync] Full sync completed for account ${account.id}. ` +
      `Processed: ${result.emailsProcessed}, Total: ${emailCount}, ` +
      `Failed: ${result.failedMessages?.length || 0}`
    );

    return {
      emailsProcessed: emailCount,
      provider: account.provider,
      fullSync: true,
      failedMessages: result.failedMessages,
    };
  }
);

async function getCheckpoint(accountId: string) {
  const jobStatus = await db.jobStatus.findUnique({
    where: {
      accountId_jobType: {
        accountId,
        jobType: 'full_sync',
      },
    },
    select: { metadata: true },
  });

  if (jobStatus?.metadata && typeof jobStatus.metadata === 'object' && 'checkpoint' in jobStatus.metadata) {
    return (jobStatus.metadata as SyncJobMetadata).checkpoint || undefined;
  }

  return undefined;
}

async function clearCheckpoint(accountId: string) {
  await JobStatusService.updateMetadata(accountId, 'full_sync', {
    checkpoint: null,
    completedAt: new Date(),
  });
}