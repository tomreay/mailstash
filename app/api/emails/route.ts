import { NextResponse } from 'next/server';
import { z } from 'zod';
import { EmailsService } from '@/lib/services/emails.service';
import { withAuth, parseQuery } from '@/lib/api';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  accountId: z.string().min(1).optional(),
  filter: z.string().min(1).optional(),
});

export const GET = withAuth(async (request, { userId }) => {
  const { page, limit, search, accountId, filter } = parseQuery(
    request,
    querySchema
  );

  const response = await EmailsService.getUserEmails(userId, {
    page,
    limit,
    search,
    accountId,
    filter,
  });

  return NextResponse.json(response);
});
