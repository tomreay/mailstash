import { NextResponse } from 'next/server';
import { retryJob } from '@/lib/jobs/queue';
import { withAuth, ValidationError } from '@/lib/api';

export const POST = withAuth<{ id: string }>(async (_request, { params }) => {
  const jobId = params.id;

  if (!jobId) {
    throw new ValidationError('Job ID is required');
  }

  await retryJob(jobId);

  return NextResponse.json({
    status: 'success',
    message: `Job ${jobId} has been reset for retry`,
  });
});
