import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { StatsService } from '@/lib/services/stats.service';

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId') || undefined;

    const stats = await StatsService.getUserStats(session.user.id, accountId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
