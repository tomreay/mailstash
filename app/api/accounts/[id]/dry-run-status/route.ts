import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: accountId } = await context.params

    // Verify the account belongs to the user and get current dry-run job ID
    const account = await db.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
      include: {
        settings: true
      }
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Only look for dry-run job if there's a current job ID set
    let dryRunJob = null
    
    if (account.settings?.currentDryRunJobId) {
      // Get the current dry-run job
      dryRunJob = await db.syncJob.findUnique({
        where: { id: account.settings.currentDryRunJobId }
      })
    }

    // Count marked emails (this is the source of truth for results)
    const markedCount = await db.email.count({
      where: {
        accountId,
        markedForDeletion: true
      }
    })

    // If no job found and no marked emails, return null status
    if (!dryRunJob && markedCount === 0) {
      return NextResponse.json({
        status: null,
        startedAt: null,
        completedAt: null,
        totalEmails: 0,
        processedEmails: 0,
        markedCount: 0,
        error: null
      })
    }

    // If we have a job, return its details
    if (dryRunJob) {
      const metadata = (dryRunJob.metadata as { totalEmails?: number; markedCount?: number }) || {}
      
      return NextResponse.json({
        status: dryRunJob.status,
        startedAt: dryRunJob.startedAt?.toISOString() || null,
        completedAt: dryRunJob.completedAt?.toISOString() || null,
        totalEmails: metadata.totalEmails || 0,
        processedEmails: dryRunJob.emailsProcessed,
        markedCount: metadata.markedCount !== undefined ? metadata.markedCount : markedCount,
        error: dryRunJob.error
      })
    }

    // No job but emails are marked - assume old completed dry-run
    return NextResponse.json({
      status: 'completed',
      startedAt: null,
      completedAt: null,
      totalEmails: markedCount,
      processedEmails: markedCount,
      markedCount,
      error: null
    })
  } catch (error) {
    console.error('Dry-run status error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dry-run status' },
      { status: 500 }
    )
  }
}