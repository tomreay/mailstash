import { NextResponse } from 'next/server';
import { retryJob } from '@/lib/jobs/queue';

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const jobId = (await params).id;
    
    if (!jobId) {
      return NextResponse.json(
        { status: 'error', error: 'Job ID is required' },
        { status: 400 }
      );
    }
    
    await retryJob(jobId);
    
    return NextResponse.json({
      status: 'success',
      message: `Job ${jobId} has been reset for retry`,
    });
  } catch (error) {
    console.error('Failed to retry job:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to retry job',
      },
      { status: 500 }
    );
  }
}