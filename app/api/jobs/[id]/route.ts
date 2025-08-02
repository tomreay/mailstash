import { NextRequest, NextResponse } from 'next/server';
import { retryJob, cancelJob } from '@/lib/jobs/queue';
import {auth} from "@/lib/auth";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: Params
) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { id } = await params;
  const body = await request.json();
  const { action } = body;
  
  try {
    switch (action) {
      case 'retry':
        await retryJob(id);
        return NextResponse.json({ success: true, message: 'Job retried' });
        
      case 'cancel':
        await cancelJob(id);
        return NextResponse.json({ success: true, message: 'Job cancelled' });
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Failed to ${action} job ${id}:`, error);
    return NextResponse.json(
      { error: `Failed to ${action} job` },
      { status: 500 }
    );
  }
}