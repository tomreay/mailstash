import { NextResponse } from 'next/server';
import { retryJob } from '@/lib/jobs/queue';
import { withAuth, ValidationError } from '@/lib/api';

// NOTE: This endpoint previously had NO authentication (issue #3) — any caller
// could retry any job id. It now requires a session. Per-job ownership scoping
// (verify the job belongs to one of the user's accounts) is tracked as a
// follow-up on #3 / the unified /api/jobs work (#13).
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
