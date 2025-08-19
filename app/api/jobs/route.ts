import { NextRequest, NextResponse } from 'next/server';
import { getActiveJobs, getFailedJobs, getPendingJobs } from '@/lib/jobs/queue';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
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
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
