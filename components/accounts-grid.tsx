'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Trash2, RefreshCw, Loader2, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/utils'
import { AccountWithStats } from '@/lib/dao/accounts.dao'

interface AccountsGridProps {
  accounts: AccountWithStats[]
}

export function AccountsGrid({ accounts: initialAccounts }: AccountsGridProps) {
  const router = useRouter()
  const [accounts] = useState(initialAccounts)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSyncAccount = async (accountId: string) => {
    try {
      setSyncing(accountId)
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      })

      if (!res.ok) {
        throw new Error('Failed to start sync')
      }

      // Refresh the page to get updated data
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sync')
    } finally {
      setSyncing(null)
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account? This will delete all associated emails and data.')) {
      return
    }

    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Failed to delete account')
      }

      // Refresh the page
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }

  const getProviderBadgeColor = (provider: string) => {
    switch (provider) {
      case 'gmail':
        return 'destructive'
      case 'imap':
        return 'secondary'
      default:
        return 'default'
    }
  }

  const getSyncStatusBadge = (status: string, lastSyncAt: string | null) => {
    if (status === 'syncing') {
      return <Badge variant="default">Syncing...</Badge>
    }
    if (status === 'error') {
      return <Badge variant="destructive">Sync Error</Badge>
    }
    if (lastSyncAt) {
      const date = new Date(lastSyncAt)
      const now = new Date()
      const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
      
      if (diffHours < 1) {
        return <Badge variant="outline">Synced recently</Badge>
      } else if (diffHours < 24) {
        return <Badge variant="outline">Synced {diffHours}h ago</Badge>
      } else {
        const diffDays = Math.floor(diffHours / 24)
        return <Badge variant="outline">Synced {diffDays}d ago</Badge>
      }
    }
    return <Badge variant="outline">Never synced</Badge>
  }

  return (
    <>
      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {accounts.length === 0 && (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No email accounts connected
          </h3>
          <p className="text-gray-500 mb-4">
            Connect an email account to start archiving your emails
          </p>
        </div>
      )}

      {/* Account List */}
      {accounts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold">
                      {account.displayName || account.email}
                    </CardTitle>
                    {account.displayName && (
                      <p className="text-sm text-gray-500 mt-1">{account.email}</p>
                    )}
                  </div>
                  <Badge variant={getProviderBadgeColor(account.provider)}>
                    {account.provider.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Emails</p>
                    <p className="font-semibold">{account.emailCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Folders</p>
                    <p className="font-semibold">{account.folderCount}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Storage</p>
                    <p className="font-semibold">{formatBytes(account.storageUsed)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    {getSyncStatusBadge(account.syncStatus, account.lastSyncAt)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleSyncAccount(account.id)}
                    disabled={syncing === account.id || account.syncStatus === 'syncing'}
                  >
                    {syncing === account.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/accounts/${account.id}/settings`)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteAccount(account.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Active Status */}
                {!account.isActive && (
                  <Badge variant="outline" className="w-full justify-center">
                    Account Disabled
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}