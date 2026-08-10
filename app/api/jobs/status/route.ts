import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveJobs, getPendingJobs, getFailedJobs } from '@/lib/jobs/queue';
import { getWorkerStatus } from '@/lib/jobs/worker';
import { withAuth, parseQuery } from '@/lib/api';

const querySchema = z.object({
  view: z.enum(['summary', 'active', 'pending', 'failed']).default('summary'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const GET = withAuth(async request => {
  const { view, limit } = parseQuery(request, querySchema);

  if (view === 'active') {
    const activeJobs = await getActiveJobs();
    return NextResponse.json({
      status: 'success',
      data: activeJobs,
    });
  }

  if (view === 'pending') {
    const pendingJobs = await getPendingJobs(limit);
    return NextResponse.json({
      status: 'success',
      data: pendingJobs,
    });
  }

  if (view === 'failed') {
    const failedJobs = await getFailedJobs(limit);
    return NextResponse.json({
      status: 'success',
      data: failedJobs,
    });
  }

  // Default summary view
  const [activeJobs, pendingJobs, failedJobs] = await Promise.all([
    getActiveJobs(),
    getPendingJobs(10),
    getFailedJobs(10),
  ]);

  const workerStatus = getWorkerStatus();

  return NextResponse.json({
    status: 'success',
    data: {
      worker: workerStatus,
      summary: {
        active: activeJobs.length,
        pending: pendingJobs.length,
        failed: failedJobs.length,
      },
      recentJobs: {
        active: activeJobs.slice(0, 5),
        pending: pendingJobs.slice(0, 5),
        failed: failedJobs.slice(0, 5),
      },
    },
  });
});
