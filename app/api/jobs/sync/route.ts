import { NextRequest, NextResponse } from 'next/server';
import {
  scheduleFullSync,
  scheduleIncrementalSync,
} from '@/lib/jobs/queue';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { JobStatusService } from '@/lib/services/job-status.service';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId } = body;

    // Verify the account belongs to the user
    const account = await db.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Check if a full sync has been completed
    const hasCompletedFullSync = await JobStatusService.hasCompletedFullSync(accountId);

    // Schedule appropriate sync type based on full sync completion
    let job;
    let syncType: string;

    if (hasCompletedFullSync) {
      job = await scheduleIncrementalSync(accountId);
      syncType = 'incremental';
    } else {
      job = await scheduleFullSync(accountId);
      syncType = 'full';
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `${syncType} sync scheduled`,
    });
  } catch (error) {
    console.error('Failed to schedule sync:', error);
    return NextResponse.json(
      { error: 'Failed to schedule sync' },
      { status: 500 }
    );
  }
}
