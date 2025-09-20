import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { JobStatusService } from '@/lib/services/job-status.service';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's email accounts
    const accounts = await db.emailAccount.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: { id: true },
    });

    if (!accounts.length) {
      return NextResponse.json({ syncJobs: [] });
    }

    const accountIds = accounts.map(a => a.id);

    // Get job statuses for all accounts
    const jobStatuses = await db.jobStatus.findMany({
      where: {
        accountId: { in: accountIds },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get current status for each job including running state
    const syncJobs = await Promise.all(
      jobStatuses.map(async (jobStatus) => {
        const currentStatus = await JobStatusService.getCurrentStatus(
          jobStatus.accountId,
          jobStatus.jobType
        );

        return {
          id: jobStatus.id,
          type: jobStatus.jobType,
          status: currentStatus.status === 'running' ? 'processing' :
                  jobStatus.success ? 'completed' : 'failed',
          accountId: jobStatus.accountId,
          emailsProcessed: (jobStatus.metadata as { emailsProcessed: number })?.emailsProcessed || 0,
          startedAt: jobStatus.lastRunAt,
          completedAt: jobStatus.lastRunAt,
          error: jobStatus.error,
          createdAt: jobStatus.updatedAt,
        };
      })
    );

    return NextResponse.json({ syncJobs });
  } catch (error) {
    console.error('Error fetching sync jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
