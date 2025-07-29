'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Search, Archive, Settings, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function QuickActions() {
  const router = useRouter()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [hasAccount, setHasAccount] = useState(false)

  useEffect(() => {
    // Check if user has an account configured
    fetch('/api/stats')
      .then(res => res.json())
      .then(() => setHasAccount(true))
      .catch(() => setHasAccount(false))
  }, [])

  const handleSync = async () => {
    try {
      setIsSyncing(true)
      setSyncError(null)
      
      const res = await fetch('/api/sync', { method: 'POST' })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed')
      }
      
      // Poll for sync status
      const pollInterval = setInterval(async () => {
        const statusRes = await fetch('/api/sync')
        const statusData = await statusRes.json()
        
        if (statusData.status !== 'syncing') {
          clearInterval(pollInterval)
          setIsSyncing(false)
          // Refresh the page to show updated stats
          router.refresh()
        }
      }, 2000)
    } catch (err) {
      setIsSyncing(false)
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>
          Manage your email archive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button className="w-full justify-start" variant="outline">
          <Mail className="h-4 w-4 mr-2" />
          View All Emails
        </Button>
        <Button className="w-full justify-start" variant="outline">
          <Search className="h-4 w-4 mr-2" />
          Search Archive
        </Button>
        <Button 
          className="w-full justify-start" 
          variant="outline"
          onClick={handleSync}
          disabled={isSyncing || !hasAccount}
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Archive className="h-4 w-4 mr-2" />
          )}
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
        <Button className="w-full justify-start" variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
        {syncError && (
          <p className="text-sm text-red-600 mt-2">{syncError}</p>
        )}
      </CardContent>
    </Card>
  )
}