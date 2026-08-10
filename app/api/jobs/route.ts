import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveJobs, getFailedJobs, getPendingJobs } from '@/lib/jobs/queue';
import { withAuth, parseQuery } from '@/lib/api';

const querySchema = z.object({
  status: z.enum(['all', 'active', 'pending', 'failed']).default('all'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const GET = withAuth(async request => {
  const { status, limit } = parseQuery(request, querySchema);

  let jobs;
  switch (status) {
    case 'active':
      jobs = await getActiveJobs();
      break;
    case 'pending':
      jobs = await getPendingJobs(limit);
      break;
    case 'failed':
      jobs = await getFailedJobs(limit);
      break;
    case 'all':
    default:
      const [active, pending, failed] = await Promise.all([
        getActiveJobs(),
        getPendingJobs(limit),
        getFailedJobs(limit),
      ]);
      jobs = {
        active,
        pending,
        failed,
      };
      break;
  }

  return NextResponse.json({ jobs });
});
