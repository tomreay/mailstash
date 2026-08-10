import { NextResponse } from 'next/server';
import { z } from 'zod';
import { StatsService } from '@/lib/services/stats.service';
import { withAuth, parseQuery } from '@/lib/api';

const querySchema = z.object({
  accountId: z.string().min(1).optional(),
});

export const GET = withAuth(async (request, { userId }) => {
  const { accountId } = parseQuery(request, querySchema);

  const stats = await StatsService.getUserStats(userId, accountId);
  return NextResponse.json(stats);
});
