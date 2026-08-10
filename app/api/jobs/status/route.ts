import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveJobs, getPendingJobs, getFailedJobs } from '@/lib/jobs/queue';
import { getWorkerStatus } from '@/lib/jobs/worker';
import { withAuth, parseQuery } from '@/lib/api';

const querySchema = z.object({
  view: z.enum(['summary', 'active', 'pending', 'failed']).default('summary'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

// NOTE: This endpoint previously had NO authentication (issue #3). It now
// requires a session. The queue helpers are not yet per-user scoped, so this
// still returns system-wide job data to any authenticated user — full
// per-account scoping is tracked as a follow-up on #3 / the unified /api/jobs
// work (#13).
export const GET = withAuth(async request => {
  const { view, limit } = parseQuery(request, querySchema);

  if (view === 'active') {
    return NextResponse.json({
      status: 'success',
      data: await getActiveJobs(),
    });
  }

  if (view === 'pending') {
    return NextResponse.json({
      status: 'success',
      data: await getPendingJobs(limit),
    });
  }

  if (view === 'failed') {
    return NextResponse.json({
      status: 'success',
      data: await getFailedJobs(limit),
    });
  }

  // Default summary view
  const [activeJobs, pendingJobs, failedJobs] = await Promise.all([
    getActiveJobs(),
    getPendingJobs(10),
    getFailedJobs(10),
  ]);

  return NextResponse.json({
    status: 'success',
    data: {
      worker: getWorkerStatus(),
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
