import { NextResponse } from 'next/server';
import { AccountsService } from '@/lib/services/accounts.service';
import { toClientSettings } from '@/lib/types/account-settings';
import { scheduleAutoDelete } from '@/lib/jobs/queue';
import { JOB_CONFIG } from '@/lib/jobs/config';
import { withAuth } from '@/lib/api';

export const PUT = withAuth<{ id: string }>(
  async (request, { userId, params }) => {
    const { id } = params;

    const body = await request.json();

    const settings = await AccountsService.updateAccountSettings(
      id,
      userId,
      body
    );

    // Check if we should trigger a dry-run
    let dryRunTriggered = false;
    if (body.autoDeleteMode === 'dry-run') {
      // Mode changed to dry-run, trigger the job
      try {
        await scheduleAutoDelete(id, {
          runAt: new Date(Date.now() + JOB_CONFIG.autoDelete.minDelay),
          priority: JOB_CONFIG.priorities.autoDelete,
        });
        dryRunTriggered = true;
      } catch (error) {
        console.error('Failed to trigger dry-run job:', error);
      }
    }

    // Convert to client format (dates as strings) and include dry-run trigger status
    return NextResponse.json({
      ...toClientSettings(settings),
      dryRunTriggered,
    });
  }
);
