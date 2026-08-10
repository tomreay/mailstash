import { NextResponse } from 'next/server';
import { AccountsService } from '@/lib/services/accounts.service';
import { toClientSettings } from '@/lib/types/account-settings';
import { withAuth } from '@/lib/api';

export const GET = withAuth<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    const account = await AccountsService.getAccountDetails(id, userId);

    // Convert settings dates to strings for client
    const clientAccount = {
      ...account,
      settings: account.settings ? toClientSettings(account.settings) : null,
    };

    return NextResponse.json({ account: clientAccount });
  }
);

export const DELETE = withAuth<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    // Verify account belongs to user before deleting
    await AccountsService.validateUserAccess(id, userId);

    // Delete account (cascading deletes will handle related data)
    await AccountsService.deleteAccount(id);

    return NextResponse.json({ success: true });
  }
);
