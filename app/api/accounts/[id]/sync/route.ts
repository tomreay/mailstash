import { NextResponse } from 'next/server';
import { AccountsService } from '@/lib/services/accounts.service';
import { withAuth } from '@/lib/api';

export const POST = withAuth<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    // Verify account belongs to user
    await AccountsService.validateUserAccess(id, userId);

    // Trigger manual sync (placeholder - implement actual sync logic)
    // TODO: Implement actual sync logic here
    console.log(`Manual sync triggered for account ${id}`);

    return NextResponse.json({ success: true, message: 'Sync triggered' });
  }
);
