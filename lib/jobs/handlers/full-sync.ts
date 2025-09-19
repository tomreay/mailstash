import { Task } from 'graphile-worker';
import { FullSyncPayload, JobResult } from '../types';
import { syncService } from '@/lib/email/sync-service';
import { db } from '@/lib/db';
import { JobStatusService, SyncCheckpoint } from '@/lib/services/job-status.service';

export const fullSyncHandler: Task = async (payload, helpers) => {
  const { accountId } = payload as FullSyncPayload;

  console.log(`[full-sync] Starting full sync for account ${accountId}`);

  try {
    // Record job start in JobStatus
    await JobStatusService.recordStart(accountId, 'sync');
    // Check if account exists and is active
    const account = await db.emailAccount.findUnique({
      where: { id: accountId },
      select: { id: true, email: true, isActive: true, provider: true },
    });

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    if (!account.isActive) {
      console.log(
        `[full-sync] Account ${accountId} is not active, skipping sync`
      );
      // Record skip in JobStatus
      await JobStatusService.recordSuccess(accountId, 'sync', {
        skipped: true,
        reason: 'Account inactive',
      });
      return;
    }

    let checkpoint: SyncCheckpoint | undefined;
    const jobStatus = await db.jobStatus.findUnique({
      where: {
        accountId_jobType: {
          accountId,
          jobType: 'sync',
        },
      },
      select: { metadata: true },
    });

    if (jobStatus?.metadata && typeof jobStatus.metadata === 'object' && 'checkpoint' in jobStatus.metadata) {
      checkpoint = (jobStatus.metadata as { checkpoint: SyncCheckpoint | null }).checkpoint || undefined;
      if (checkpoint) {
        console.log('[full-sync] Found existing checkpoint, resuming sync');
      }
    }


    // Track progress through sync status instead of modifying job
    console.log(`[full-sync] Starting sync for account ${accountId}`);

    // Perform the sync with checkpoint if available
    await syncService.syncAccount(accountId, checkpoint);

    // Get sync statistics
    const emailCount = await db.email.count({
      where: { accountId },
    });

    // Record successful completion in JobStatus
    await JobStatusService.recordSuccess(accountId, 'sync', {
      emailsProcessed: emailCount,
      provider: account.provider,
      fullSync: true,
    });

    // Log completion
    console.log(`[full-sync] Completed sync for account ${accountId}`);

    const result: JobResult = {
      success: true,
      emailsProcessed: emailCount,
    };

    console.log(
      `[full-sync] Full sync completed for account ${accountId}`,
      result
    );

    // Get history ID for Gmail accounts from _SYNC_STATE folder
    const syncFolder = await db.folder.findFirst({
      where: {
        accountId,
        path: '_SYNC_STATE',
      },
      select: { lastSyncId: true },
    });

    // Schedule next incremental sync in 5 minutes
    await helpers.addJob(
      'email:incremental_sync',
      {
        accountId,
        gmailHistoryId: syncFolder?.lastSyncId,
        lastSyncAt: new Date().toISOString(),
      },
      {
        runAt: new Date(Date.now() + 5 * 60 * 1000),
        jobKey: `email:incremental_sync:${accountId}`
      }
    );

    // Explicitly return to signal successful completion
    return;
  } catch (error) {
    console.error(
      `[full-sync] Full sync failed for account ${accountId}`,
      error
    );

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isFinalAttempt = helpers.job.attempts >= helpers.job.max_attempts;

    // Record failure in JobStatus
    await JobStatusService.recordFailure(accountId, 'sync', errorMessage, {
      attempt: helpers.job.attempts,
      maxAttempts: helpers.job.max_attempts,
      isFinal: isFinalAttempt,
      fullSync: true,
    });

    // If this is a transient error, let graphile-worker retry
    if (error instanceof Error && isTransientError(error)) {
      throw error;
    }

    // Don't throw to prevent retries for permanent errors
    console.error('[full-sync] Permanent error, not retrying', error);
  }
};

function isTransientError(error: Error): boolean {
  const transientErrors = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ECONNRESET',
    'rate limit',
    'quota exceeded',
    '429',
    '503',
    '504',
  ];

  const message = error.message.toLowerCase();
  return transientErrors.some(err => message.includes(err.toLowerCase()));
}
