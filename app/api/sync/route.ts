import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scheduleFullSync, scheduleIncrementalSync } from '@/lib/jobs/queue';
import { SyncResponse } from '@/types';
import { JobStatusService } from '@/lib/services/job-status.service';
import { withAuth, NotFoundError, ValidationError } from '@/lib/api';

export const POST = withAuth(async (request, { userId }) => {
  // Get the accountId from the request body
  const body = await request.json();
  const { accountId } = body;

  if (!accountId) {
    throw new ValidationError('Account ID is required');
  }

  // Get the specific email account
  const account = await db.emailAccount.findFirst({
    where: {
      id: accountId,
      userId, // Ensure the account belongs to the user
      isActive: true,
    },
  });

  if (!account) {
    throw new NotFoundError('Email account not found or unauthorized');
  }

  // Check job status to determine sync type (check for any sync job type)
  const jobStatus = await db.jobStatus.findFirst({
    where: {
      accountId: account.id,
      jobType: { in: ['incremental_sync', 'full_sync'] },
    },
    orderBy: { lastRunAt: 'desc' },
  });

  // Get Gmail history ID from _SYNC_STATE folder if needed
  const syncFolder =
    account.provider === 'gmail'
      ? await db.folder.findFirst({
          where: {
            accountId: account.id,
            path: '_SYNC_STATE',
          },
        })
      : null;

  // Schedule appropriate sync job based on sync history
  let job;
  if (!jobStatus || !jobStatus.lastRunAt) {
    // First sync or no previous sync - schedule full sync
    job = await scheduleFullSync(account.id, {}, { priority: 10 });
  } else {
    // Schedule incremental sync
    job = await scheduleIncrementalSync(
      account.id,
      {
        lastSyncAt: jobStatus.lastRunAt.toISOString(),
        gmailHistoryId: syncFolder?.lastSyncId || undefined,
      },
      { priority: 10 }
    );
  }

  const response: SyncResponse = {
    message: 'Sync scheduled successfully',
    accountId: account.id,
    jobId: job.id,
  };

  return NextResponse.json(response);
});

export const GET = withAuth(async (_request, { userId }) => {
  // Get user's email account
  const account = await db.emailAccount.findFirst({
    where: {
      userId,
      isActive: true,
    },
  });

  if (!account) {
    const response: SyncResponse = {
      status: 'idle',
      lastSyncAt: null,
      error: null,
    };
    return NextResponse.json(response);
  }

  // Get current sync status from JobStatus
  const currentStatus = await JobStatusService.getCurrentStatus(
    account.id,
    'sync'
  );

  const response: SyncResponse = {
    status:
      currentStatus.status === 'running'
        ? 'syncing'
        : currentStatus.status === 'error'
          ? 'error'
          : 'idle',
    lastSyncAt: currentStatus.lastRunAt?.toISOString() || null,
    error: currentStatus.error || null,
  };

  return NextResponse.json(response);
});
