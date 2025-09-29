import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AccountsService } from '@/lib/services/accounts.service';
import { toClientSettings } from '@/lib/types/account-settings';
import { scheduleAutoDelete } from '@/lib/jobs/queue';
import { JOB_CONFIG } from '@/lib/jobs/config';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const settings = await AccountsService.updateAccountSettings(
      id,
      session.user.id,
      body
    );

    // Check if we should trigger a dry-run
    let dryRunTriggered = false;
    if (body.autoDeleteMode === 'dry-run') {
      // Mode changed to dry-run, trigger the job
      try {
        await scheduleAutoDelete(id, {
          runAt: new Date(Date.now() + JOB_CONFIG.autoDelete.minDelay),
          priority: JOB_CONFIG.priorities.autoDelete
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
  } catch (error) {
    console.error('Error updating account settings:', error);

    if (
      error instanceof Error &&
      error.message === 'Account not found or access denied'
    ) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
