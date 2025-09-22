import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  scheduleFullSync,
  scheduleIncrementalSync,
} from '@/lib/jobs/queue';
import { SyncResponse } from '@/types';
import { JobStatusService } from '@/lib/services/job-status.service';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the accountId from the request body
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Get the specific email account
    const account = await db.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id, // Ensure the account belongs to the user
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Email account not found or unauthorized' },
        { status: 404 }
      );
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
    const syncFolder = account.provider === 'gmail' ?
      await db.folder.findFirst({
        where: {
          accountId: account.id,
          path: '_SYNC_STATE',
        },
      }) : null;

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
  } catch (error) {
    console.error('Error starting sync:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's email account
    const account = await db.emailAccount.findFirst({
      where: {
        userId: session.user.id,
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
      status: currentStatus.status === 'running' ? 'syncing' :
              currentStatus.status === 'error' ? 'error' : 'idle',
      lastSyncAt: currentStatus.lastRunAt?.toISOString() || null,
      error: currentStatus.error || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
