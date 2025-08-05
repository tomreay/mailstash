'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AccountWithStats } from '@/lib/dao/accounts.dao'
import { AccountCard } from './account-card'

interface AccountListProps {
  accounts: AccountWithStats[]
}

export function AccountList({ accounts }: AccountListProps) {
  const router = useRouter()
  const [syncing, setSyncing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSyncAccount = async (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation()
    try {
      setSyncing(accountId)
      setError(null)
      
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

  const handleAccountClick = (accountId: string) => {
    router.push(`/emails?accountId=${accountId}`)
  }

  const handleSettingsClick = (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation()
    router.push(`/accounts/${accountId}/settings`)
  }

  return (
    <>
      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Account Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Add Account Card */}
        <Card 
          className="border-2 border-dashed border-gray-300 hover:border-gray-400 cursor-pointer transition-colors"
          onClick={() => router.push('/accounts/new')}
        >
          <CardContent className="justify-center items-center flex flex-col h-full">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-gray-600" />
            </div>
            <CardTitle className="text-lg">Add Email Account</CardTitle>
            <CardDescription>
              Connect a new email account to start archiving
            </CardDescription>
          </CardContent>
        </Card>

        {/* Account Cards */}
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            isSyncing={syncing === account.id}
            onSync={(e) => handleSyncAccount(e, account.id)}
            onClick={() => handleAccountClick(account.id)}
            onSettings={(e) => handleSettingsClick(e, account.id)}
          />
        ))}
      </div>

      {/* Empty State */}
      {accounts.length === 0 && (
        <Card className="mb-8">
          <CardContent className="text-center py-12">
            <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-6 w-6 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No email accounts connected
            </h3>
            <p className="text-gray-500 mb-4">
              Connect an email account to start archiving your emails
            </p>
            <Button onClick={() => router.push('/accounts/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Account
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}