import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { JobStatusService } from '@/lib/services/job-status.service';

export async function RecentActivity() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // First get user's account IDs
  const userAccounts = await db.emailAccount.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  const accountIds = userAccounts.map(a => a.id);

  // Fetch job statuses
  const jobStatuses = await db.jobStatus.findMany({
    where: {
      accountId: {
        in: accountIds,
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 5,
  });

  // Transform to sync jobs format with running state
  const syncJobs = await Promise.all(
    jobStatuses.map(async (jobStatus) => {
      const currentStatus = await JobStatusService.getCurrentStatus(
        jobStatus.accountId,
        jobStatus.jobType
      );
      const metadata = jobStatus.metadata as any || {};

      return {
        id: jobStatus.id,
        type: jobStatus.jobType,
        status: currentStatus.status === 'running' ? 'processing' :
                jobStatus.success ? 'completed' : 'failed',
        emailsProcessed: metadata.emailsProcessed || 0,
        error: jobStatus.error,
        startedAt: jobStatus.lastRunAt,
      };
    })
  );

  // Get stats
  const accounts = await db.emailAccount.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      jobStatuses: {
        where: { jobType: 'sync' },
      },
    },
  });

  const totalEmails = await db.email.count({
    where: {
      account: {
        userId: session.user.id,
      },
    },
  });

  // Check sync status for each account
  const syncStatuses = await Promise.all(
    accounts.map(async (account) => {
      const status = await JobStatusService.getCurrentStatus(account.id, 'sync');
      return {
        accountId: account.id,
        lastSyncAt: status.lastRunAt,
        isSyncing: status.status === 'running',
      };
    })
  );

  const lastSync = syncStatuses
    .map(s => s.lastSyncAt)
    .filter(Boolean)
    .sort((a, b) => b!.getTime() - a!.getTime())[0];

  const anySyncing = syncStatuses.some(s => s.isSyncing);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest email synchronization events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {syncJobs.length > 0 && (
            <div className='space-y-2'>
              <div className='text-sm font-medium mb-2'>Recent Sync Jobs</div>
              {syncJobs.map(job => {
                const jobType = job.type.replace('_', ' ').toUpperCase();
                const isProcessing = job.status === 'processing';
                const isCompleted = job.status === 'completed';
                const isFailed = job.status === 'failed';

                return (
                  <div
                    key={job.id}
                    className='flex items-center justify-between text-sm'
                  >
                    <div className='flex items-center'>
                      <Badge
                        variant={
                          isProcessing
                            ? 'default'
                            : isCompleted
                              ? 'secondary'
                              : 'destructive'
                        }
                        className='mr-2'
                      >
                        {jobType}
                      </Badge>
                      <span className='text-muted-foreground'>
                        {isProcessing && 'In progress...'}
                        {isCompleted &&
                          `Completed ${job.emailsProcessed || 0} emails`}
                        {isFailed && (job.error || 'Failed')}
                      </span>
                    </div>
                    <span className='text-xs text-muted-foreground'>
                      {job.startedAt
                        ? new Date(job.startedAt).toLocaleTimeString()
                        : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {anySyncing && (
            <div className='flex items-center'>
              <Badge variant='secondary' className='mr-2'>
                SYNC
              </Badge>
              <span className='text-sm'>
                Email synchronization in progress...
              </span>
            </div>
          )}
          {lastSync && (
            <div className='flex items-center'>
              <Badge variant='secondary' className='mr-2'>
                INFO
              </Badge>
              <span className='text-sm'>
                Last sync: {new Date(lastSync).toLocaleString()}
              </span>
            </div>
          )}
          {totalEmails > 0 && (
            <div className='flex items-center'>
              <Badge variant='secondary' className='mr-2'>
                INFO
              </Badge>
              <span className='text-sm'>
                {totalEmails.toLocaleString()} emails archived
              </span>
            </div>
          )}
          {!lastSync && !anySyncing && syncJobs.length === 0 && (
            <div className='flex items-center'>
              <Badge variant='outline' className='mr-2'>
                INFO
              </Badge>
              <span className='text-sm text-muted-foreground'>
                No sync activity yet. Click &quot;Sync Now&quot; to start.
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
