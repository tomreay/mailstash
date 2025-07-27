import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { syncService } from '@/lib/email/sync-service'

export async function POST() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email account
    const account = await db.emailAccount.findUnique({
      where: { email: session.user.email },
    })

    if (!account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    // Check if sync is already in progress
    const syncStatus = await db.syncStatus.findUnique({
      where: { accountId: account.id },
    })

    if (syncStatus?.syncStatus === 'syncing') {
      return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 })
    }

    // Trigger sync asynchronously
    syncService.syncAccount(account.id).catch(error => {
      console.error('Sync failed:', error)
    })

    return NextResponse.json({ 
      message: 'Sync started successfully',
      accountId: account.id 
    })
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
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email account
    const account = await db.emailAccount.findUnique({
      where: { email: session.user.email },
      include: {
        syncStatus: true,
      },
    })

    if (!account) {
      return NextResponse.json({ 
        status: 'idle',
        lastSyncAt: null,
        error: null 
      })
    }

    return NextResponse.json({
      status: account.syncStatus?.syncStatus || 'idle',
      lastSyncAt: account.syncStatus?.lastSyncAt?.toISOString() || null,
      error: account.syncStatus?.errorMessage || null,
    })
  } catch (error) {
    console.error('Error fetching sync status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}