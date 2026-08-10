import { NextResponse } from 'next/server';
import { z } from 'zod';
import { retryJob, cancelJob } from '@/lib/jobs/queue';
import { withAuth, parseJson } from '@/lib/api';

const bodySchema = z.object({
  action: z.enum(['retry', 'cancel']),
});

export const POST = withAuth<{ id: string }>(async (request, { params }) => {
  const { id } = params;
  const { action } = await parseJson(request, bodySchema);

  switch (action) {
    case 'retry':
      await retryJob(id);
      return NextResponse.json({ success: true, message: 'Job retried' });

    case 'cancel':
      await cancelJob(id);
      return NextResponse.json({ success: true, message: 'Job cancelled' });
  }
});
