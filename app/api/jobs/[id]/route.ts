import { NextResponse } from 'next/server';
import { retryJob, cancelJob } from '@/lib/jobs/queue';
import { withAuth, ValidationError } from '@/lib/api';

export const POST = withAuth<{ id: string }>(async (request, { params }) => {
  const { id } = params;
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case 'retry':
      await retryJob(id);
      return NextResponse.json({ success: true, message: 'Job retried' });

    case 'cancel':
      await cancelJob(id);
      return NextResponse.json({ success: true, message: 'Job cancelled' });

    default:
      throw new ValidationError('Invalid action');
  }
});
