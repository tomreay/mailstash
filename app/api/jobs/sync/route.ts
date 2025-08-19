import { NextRequest, NextResponse } from 'next/server';
import {
  scheduleFullSync,
  scheduleIncrementalSync,
  scheduleFolderSync,
} from '@/lib/jobs/queue';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId, type = 'full', folderId, priority } = body;

    // Verify the account belongs to the user
    const account = await db.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    let job;
    const options = priority
      ? { priority: priority === 'high' ? 10 : 0 }
      : undefined;

    switch (type) {
      case 'full':
        job = await scheduleFullSync(accountId, {}, options);
        break;

      case 'incremental':
        job = await scheduleIncrementalSync(accountId, {}, options);
        break;

      case 'folder':
        if (!folderId) {
          return NextResponse.json(
            { error: 'Folder ID required for folder sync' },
            { status: 400 }
          );
        }

        const folder = await db.folder.findUnique({
          where: { id: folderId },
        });

        if (!folder || folder.accountId !== accountId) {
          return NextResponse.json(
            { error: 'Folder not found' },
            { status: 404 }
          );
        }

        job = await scheduleFolderSync(
          accountId,
          folderId,
          folder.path,
          {},
          options
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid sync type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `${type} sync scheduled`,
    });
  } catch (error) {
    console.error('Failed to schedule sync:', error);
    return NextResponse.json(
      { error: 'Failed to schedule sync' },
      { status: 500 }
    );
  }
}
