import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { StatsResponse } from '@/types'

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
        _count: {
          select: {
            emails: true,
          },
        },
      },
    })

    if (!account) {
      const response: StatsResponse = {
        totalEmails: 0,
        unreadEmails: 0,
        totalAttachments: 0,
        storageUsed: 0,
        lastSyncAt: null,
        syncStatus: 'idle',
      }
      return NextResponse.json(response)
    }

    // Get additional stats
    const [storageStats, unreadCount, attachmentCount] = await Promise.all([
      db.email.aggregate({
        where: { accountId: account.id },
        _sum: { size: true },
      }),
      db.email.count({
        where: { accountId: account.id, isRead: false },
      }),
      db.attachment.count({
        where: { email: { accountId: account.id } },
      }),
    ])

    const response: StatsResponse = {
      totalEmails: account._count.emails,
      unreadEmails: unreadCount,
      totalAttachments: attachmentCount,
      storageUsed: storageStats._sum.size || 0,
      lastSyncAt: account.syncStatus?.lastSyncAt?.toISOString() || null,
      syncStatus: (account.syncStatus?.syncStatus as 'idle' | 'syncing' | 'error') || 'idle',
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}