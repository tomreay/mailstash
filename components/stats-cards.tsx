import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Archive, Mail, Settings } from 'lucide-react'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

async function getStats() {
  const session = await auth()
  
  if (!session?.user?.email) {
    return {
      totalEmails: 0,
      totalSize: 0,
      lastSync: null,
    }
  }

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
    return {
      totalEmails: 0,
      totalSize: 0,
      lastSync: null,
    }
  }

  const storageStats = await db.email.aggregate({
    where: { accountId: account.id },
    _sum: { size: true },
  })

  return {
    totalEmails: account._count.emails,
    totalSize: storageStats._sum.size || 0,
    lastSync: account.syncStatus?.lastSyncAt?.toISOString() || null,
  }
}

export async function StatsCards() {
  const stats = await getStats()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalEmails.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Archived emails
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
          <Archive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(stats.totalSize / 1024 / 1024).toFixed(1)} MB
          </div>
          <p className="text-xs text-muted-foreground">
            Email and attachments
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
          <Settings className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.lastSync ? new Date(stats.lastSync).toLocaleDateString() : 'Never'}
          </div>
          <p className="text-xs text-muted-foreground">
            Gmail synchronization
          </p>
        </CardContent>
      </Card>
    </div>
  )
}