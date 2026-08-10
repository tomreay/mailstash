import { NextResponse } from 'next/server';
import { z } from 'zod';
import { scheduleFullSync, scheduleIncrementalSync } from '@/lib/jobs/queue';
import { AccountsService } from '@/lib/services/accounts.service';
import { JobStatusService } from '@/lib/services/job-status.service';
import { withAuth, parseJson } from '@/lib/api';

const bodySchema = z.object({
  accountId: z.string().min(1),
});

export const POST = withAuth(async (request, { userId }) => {
  const { accountId } = await parseJson(request, bodySchema);

  // Verify the account belongs to the user (throws NotFoundError → 404)
  await AccountsService.validateUserAccess(accountId, userId);

  // Schedule appropriate sync type based on full sync completion
  const hasCompletedFullSync =
    await JobStatusService.hasCompletedFullSync(accountId);

  const job = hasCompletedFullSync
    ? await scheduleIncrementalSync(accountId)
    : await scheduleFullSync(accountId);
  const syncType = hasCompletedFullSync ? 'incremental' : 'full';

  return NextResponse.json({
    success: true,
    jobId: job.id,
    message: `${syncType} sync scheduled`,
  });
});
