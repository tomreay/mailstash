import { NextResponse } from 'next/server'
import {auth} from "@/lib/auth";
import {db} from "@/lib/db";

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
      return NextResponse.json({
        totalEmails: 0,
        totalSize: 0,
        lastSync: null,
      })
    }

    // Get storage stats
    const storageStats = await db.email.aggregate({
      where: { accountId: account.id },
      _sum: { size: true },
    })

    return NextResponse.json({
      totalEmails: account._count.emails,
      totalSize: storageStats._sum.size || 0,
      lastSync: account.syncStatus?.lastSyncAt?.toISOString() || null,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}