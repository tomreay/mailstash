import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AccountsService } from '@/lib/services/accounts.service';

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify account belongs to user
    await AccountsService.validateUserAccess(id, session.user.id);

    // Trigger manual sync (placeholder - implement actual sync logic)
    // TODO: Implement actual sync logic here
    console.log(`Manual sync triggered for account ${id}`);

    return NextResponse.json({ success: true, message: 'Sync triggered' });
  } catch (error) {
    console.error('Error triggering sync:', error);

    if (
      error instanceof Error &&
      error.message === 'Account not found or access denied'
    ) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
