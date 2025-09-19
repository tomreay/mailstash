import { Task } from 'graphile-worker';
import { FullSyncPayload, JobResult } from '../types';
import { syncService } from '@/lib/email/sync-service';
import { db } from '@/lib/db';
import { SyncJob } from '@/types';
import { JobStatusService } from '@/lib/services/job-status.service';

export const fullSyncHandler: Task = async (payload, helpers) => {
  let syncJob: SyncJob | null = null;
  const { accountId, resumeFromCheckpoint } = payload as FullSyncPayload;

  console.log(`[full-sync] Starting full sync for account ${accountId}`);

  try {
    // DUAL WRITE: Create old sync job record
    syncJob = await db.syncJob.create({
      data: {
        type: 'full_sync',
        status: 'processing',
        accountId,
        startedAt: new Date(),
        emailsProcessed: 0,
      },
    });

    // DUAL WRITE: Record job start in new JobStatus
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
      // DUAL WRITE: Record skip in new JobStatus
      await JobStatusService.recordSuccess(accountId, 'sync', {
        skipped: true,
        reason: 'Account inactive',
      });
      return;
    }

    // DUAL WRITE: Update old sync status to syncing
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

    // Track progress through sync status instead of modifying job
    console.log(`[full-sync] Starting sync for account ${accountId}`);

    // If resuming from checkpoint, update sync service to handle it
    if (resumeFromCheckpoint) {
      console.log('[full-sync] Resuming from checkpoint', resumeFromCheckpoint);
      // TODO: Implement checkpoint resume logic in sync service
    }

    // Perform the sync
    await syncService.syncAccount(accountId);

    // Get sync statistics
    const emailCount = await db.email.count({
      where: { accountId },
    });

    // DUAL WRITE: Update old sync job to completed
    await db.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        emailsProcessed: emailCount,
      },
    });

    // DUAL WRITE: Record successful completion in new JobStatus
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

    // Get sync status to include history ID for Gmail accounts
    const syncStatus = await db.syncStatus.findUnique({
      where: { accountId },
      select: { gmailHistoryId: true },
    });

    // DUAL WRITE: Update old sync status to idle
    await db.syncStatus.update({
      where: { accountId },
      data: {
        syncStatus: 'idle',
        lastSyncAt: new Date(),
        errorMessage: null,
      },
    });

    // Schedule next incremental sync in 5 minutes
    await helpers.addJob(
      'email:incremental_sync',
      {
        accountId,
        gmailHistoryId: syncStatus?.gmailHistoryId,
        lastSyncAt: new Date().toISOString(),
      },
      { runAt: new Date(Date.now() + 5 * 60 * 1000) }
    );
  } catch (error) {
    console.error(
      `[full-sync] Full sync failed for account ${accountId}`,
      error
    );

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isFinalAttempt = helpers.job.attempts >= helpers.job.max_attempts;

    // DUAL WRITE: Update old sync job to failed
    if (syncJob) {
      await db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        },
      });
    }

    // DUAL WRITE: Record failure in new JobStatus
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

    // DUAL WRITE: For permanent errors, update old sync status and don't retry
    await db.syncStatus.upsert({
      where: { accountId },
      update: {
        syncStatus: 'error',
        errorMessage: errorMessage,
      },
      create: {
        accountId,
        syncStatus: 'error',
        errorMessage: errorMessage,
      },
    });

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
