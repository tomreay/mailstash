import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { scheduleFullSync, scheduleIncrementalSync, getActiveJobs } from '@/lib/jobs/queue'
import { SyncResponse } from '@/types'

export async function POST() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email account
    const account = await db.emailAccount.findFirst({
      where: { 
        userId: session.user.id,
        isActive: true 
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    // Check if sync is already in progress by checking for active jobs
    const syncStatus = await db.syncStatus.findUnique({
      where: { accountId: account.id },
    })

    // Schedule appropriate sync job based on sync history
    let job;
    if (!syncStatus || !syncStatus.lastSyncAt) {
      // First sync or no previous sync - schedule full sync
      job = await scheduleFullSync(account.id, {}, { priority: 10 })
    } else {
      // Schedule incremental sync
      job = await scheduleIncrementalSync(
        account.id, 
        {
          lastSyncAt: syncStatus.lastSyncAt.toISOString(),
          gmailHistoryId: syncStatus.gmailHistoryId || undefined,
        },
        { priority: 10 }
      )
    }

    const response: SyncResponse = {
      message: 'Sync scheduled successfully',
      accountId: account.id,
      jobId: job.id
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error starting sync:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email account
    const account = await db.emailAccount.findFirst({
      where: { 
        userId: session.user.id,
        isActive: true 
      },
      include: {
        syncStatus: true,
      },
    })

    if (!account) {
      const response: SyncResponse = {
        status: 'idle',
        lastSyncAt: null,
        error: null
      }
      return NextResponse.json(response)
    }

    // Check for active sync jobs
    const activeJobs = await getActiveJobs()
    const isSyncing = activeJobs.some((job) => 
      job.payload?.accountId === account.id &&
      (job.task_identifier === 'email:full_sync' || job.task_identifier === 'email:incremental_sync')
    )

    const response: SyncResponse = {
      status: isSyncing ? 'syncing' : (account.syncStatus?.syncStatus as 'idle' | 'syncing' | 'error') || 'idle',
      lastSyncAt: account.syncStatus?.lastSyncAt?.toISOString() || null,
      error: account.syncStatus?.errorMessage || null,
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching sync status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}