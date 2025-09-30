import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { JobStatusService, AutoDeleteJobMetadata } from '@/lib/services/job-status.service';
import { DryRunStatusData } from '@/types/dry-run';

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: accountId } = await context.params;

    // Verify the account belongs to the user and get current dry-run job ID
    const account = await db.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
      include: {
        settings: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get auto-delete job status
    const currentStatus = await JobStatusService.getCurrentStatus(
      accountId,
      'auto_delete'
    );

    // Check if there's a queued job that hasn't started yet
    const hasQueuedJob = await JobStatusService.getQueuedJob(accountId, 'auto_delete');

    // Debug logging
    console.log('[dry-run-status] Current job status:', {
      accountId,
      status: currentStatus.status,
      hasQueuedJob,
      lastRunAt: currentStatus.lastRunAt,
      metadata: currentStatus.metadata,
      error: currentStatus.error,
    });

    // If there's a queued job, show pending status (don't show old results)
    if (hasQueuedJob) {
      return NextResponse.json({
        status: 'pending',
        startedAt: null,
        completedAt: null,
        totalEmails: 0,
        processedEmails: 0,
        markedCount: 0,
        error: null,
      });
    }

    // Count marked emails (this is the source of truth for results)
    const markedCount = await db.email.count({
      where: {
        accountId,
        markedForDeletion: true,
      },
    });

    console.log('[dry-run-status] Marked email count:', markedCount);

    // If no job history and no marked emails, return null status
    if (currentStatus.status === 'never_run' && markedCount === 0) {
      return NextResponse.json({
        status: null,
        startedAt: null,
        completedAt: null,
        totalEmails: 0,
        processedEmails: 0,
        markedCount: 0,
        error: null,
      });
    }

    // Get metadata from job status with proper typing
    const metadata = (currentStatus.metadata as AutoDeleteJobMetadata) || {};

    // Map job status to dry run status
    let status: DryRunStatusData['status'];
    let completedAt: string | null = null;

    switch (currentStatus.status) {
      case 'running':
        status = 'running';
        break;
      case 'error':
        status = 'failed';
        break;
      case 'idle':
        status = 'completed';
        completedAt = currentStatus.lastRunAt?.toISOString() || null;
        break;
      case 'never_run':
        // If we've never run but have marked emails, something is inconsistent
        // Most likely leftover from a previous run
        status = markedCount > 0 ? 'completed' : null;
        break;
      default:
        status = null;
    }

    // For dry run, we don't track granular progress during processing
    // Progress tracking is not meaningful for this operation
    const totalEmails = status === 'completed' ? (metadata.count || markedCount) : 0;
    const processedEmails = status === 'completed' ? totalEmails : 0;

    const response: DryRunStatusData = {
      status,
      startedAt: currentStatus.lastRunAt?.toISOString() || null,
      completedAt,
      totalEmails,
      processedEmails,
      markedCount,
      error: currentStatus.error || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dry-run status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dry-run status' },
      { status: 500 }
    );
  }
}
