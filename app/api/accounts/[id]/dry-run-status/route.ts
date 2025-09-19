import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { JobStatusService } from '@/lib/services/job-status.service';

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: accountId } = await context.params;

    // Verify the account belongs to the user and get current dry-run job ID
    const account = await db.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
      include: {
        settings: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get auto-delete job status
    const currentStatus = await JobStatusService.getCurrentStatus(
      accountId,
      'auto_delete'
    );

    // Count marked emails (this is the source of truth for results)
    const markedCount = await db.email.count({
      where: {
        accountId,
        markedForDeletion: true,
      },
    });

    // If no job history and no marked emails, return null status
    if (currentStatus.status === 'never_run' && markedCount === 0) {
      return NextResponse.json({
        status: null,
        startedAt: null,
        completedAt: null,
        totalEmails: 0,
        processedEmails: 0,
        markedCount: 0,
        error: null,
      });
    }

    // Get metadata from job status
    const metadata = currentStatus.metadata || {};
    const totalEmails = (metadata as any)?.totalEmails || markedCount;
    const processedEmails = (metadata as any)?.count || markedCount;

    return NextResponse.json({
      status: currentStatus.status === 'running' ? 'processing' :
              currentStatus.status === 'error' ? 'failed' :
              currentStatus.status === 'idle' ? 'completed' : null,
      startedAt: currentStatus.lastRunAt?.toISOString() || null,
      completedAt: currentStatus.status === 'idle' ? currentStatus.lastRunAt?.toISOString() : null,
      totalEmails,
      processedEmails,
      markedCount,
      error: currentStatus.error || null,
    });
  } catch (error) {
    console.error('Dry-run status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dry-run status' },
      { status: 500 }
    );
  }
}
