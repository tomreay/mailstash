import { NextResponse } from 'next/server';
import { EmailsService } from '@/lib/services/emails.service';
import { withAuth } from '@/lib/api';

export const GET = withAuth(async (request, { userId }) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || undefined;
  const accountId = searchParams.get('accountId') || undefined;

  const response = await EmailsService.getUserEmails(userId, {
    page,
    limit,
    search,
    accountId,
  });

  return NextResponse.json(response);
});
