import { NextResponse } from 'next/server';
import { getActiveJobs, getPendingJobs, getFailedJobs } from '@/lib/jobs/queue';
import { getWorkerStatus } from '@/lib/jobs/worker';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'summary';
    
    if (view === 'active') {
      const activeJobs = await getActiveJobs();
      return NextResponse.json({ 
        status: 'success',
        data: activeJobs,
      });
    }
    
    if (view === 'pending') {
      const limit = parseInt(searchParams.get('limit') || '100');
      const pendingJobs = await getPendingJobs(limit);
      return NextResponse.json({ 
        status: 'success',
        data: pendingJobs,
      });
    }
    
    if (view === 'failed') {
      const limit = parseInt(searchParams.get('limit') || '100');
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
  } catch (error) {
    console.error('Failed to get job status:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to get job status',
      },
      { status: 500 }
    );
  }
}