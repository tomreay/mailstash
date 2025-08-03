import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's email accounts
    const accounts = await db.emailAccount.findMany({
      where: { 
        userId: session.user.id,
        isActive: true 
      },
      select: { id: true },
    });

    if (!accounts.length) {
      return NextResponse.json({ syncJobs: [] });
    }

    const accountIds = accounts.map(a => a.id);
    
    // Get recent sync jobs
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const syncJobs = await db.syncJob.findMany({
      where: {
        accountId: { in: accountIds },
      },
      orderBy: [
        { startedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        type: true,
        status: true,
        accountId: true,
        emailsProcessed: true,
        startedAt: true,
        completedAt: true,
        error: true,
        createdAt: true,
      },
    });
    
    return NextResponse.json({ syncJobs });
  } catch (error) {
    console.error('Error fetching sync jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}