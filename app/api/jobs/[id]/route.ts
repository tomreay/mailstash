import { NextResponse } from 'next/server';
import { z } from 'zod';
import { retryJob, cancelJob } from '@/lib/jobs/queue';
import { withAuth, parseJson } from '@/lib/api';

const bodySchema = z.object({
  action: z.enum(['retry', 'cancel']),
});

// NOTE: Per-job ownership scoping (verify the job belongs to one of the user's
// accounts) is tracked as a follow-up on #3 / the unified /api/jobs work (#13).
export const POST = withAuth<{ id: string }>(async (request, { params }) => {
  const { action } = await parseJson(request, bodySchema);

  switch (action) {
    case 'retry':
      await retryJob(params.id);
      return NextResponse.json({ success: true, message: 'Job retried' });

    case 'cancel':
      await cancelJob(params.id);
      return NextResponse.json({ success: true, message: 'Job cancelled' });
  }
});
