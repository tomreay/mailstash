import { NextResponse } from 'next/server';
import { scheduleFullSync, scheduleIncrementalSync } from '@/lib/jobs/queue';
import { db } from '@/lib/db';
import { JobStatusService } from '@/lib/services/job-status.service';
import { withAuth, NotFoundError } from '@/lib/api';

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const { accountId } = body;

  // Verify the account belongs to the user
  const account = await db.emailAccount.findFirst({
    where: {
      id: accountId,
      userId,
    },
  });

  if (!account) {
    throw new NotFoundError('Account not found');
  }

  // Check if a full sync has been completed
  const hasCompletedFullSync =
    await JobStatusService.hasCompletedFullSync(accountId);

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
});
