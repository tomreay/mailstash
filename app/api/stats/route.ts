import { NextResponse } from 'next/server';
import { StatsService } from '@/lib/services/stats.service';
import { withAuth } from '@/lib/api';

export const GET = withAuth(async (request, { userId }) => {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId') || undefined;

  const stats = await StatsService.getUserStats(userId, accountId);
  return NextResponse.json(stats);
});
