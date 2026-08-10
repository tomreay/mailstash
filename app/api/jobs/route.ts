import { NextResponse } from 'next/server';
import { getActiveJobs, getFailedJobs, getPendingJobs } from '@/lib/jobs/queue';
import { withAuth } from '@/lib/api';

export const GET = withAuth(async request => {
  const searchParams = new URL(request.url).searchParams;
  const status = searchParams.get('status') || 'all';
  const limit = parseInt(searchParams.get('limit') || '100', 10);

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
