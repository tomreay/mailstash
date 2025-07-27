'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Archive, Search, Settings, LogOut, Loader2 } from 'lucide-react'

export default function Home() {
  const { data: session, status } = useSession()
  const [stats, setStats] = useState<{
    totalEmails: number
    totalSize: number
    lastSync: string | null
  }>({
    totalEmails: 0,
    totalSize: 0,
    lastSync: null,
  })
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      fetchStats()
      fetchSyncStatus()
    }
  }, [session])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/sync')
      const data = await res.json()
      setSyncStatus(data.status || 'idle')
      setSyncError(data.error || null)
    } catch (err) {
      console.error('Error fetching sync status:', err)
    }
  }

  const handleSync = async () => {
    try {
      setSyncStatus('syncing')
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
        
        setSyncStatus(statusData.status || 'idle')
        setSyncError(statusData.error || null)
        
        if (statusData.status !== 'syncing') {
          clearInterval(pollInterval)
          // Refresh stats after sync completes
          fetchStats()
        }
      }, 2000)
    } catch (err) {
      setSyncStatus('error')
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Mail className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">MailStash</CardTitle>
            <CardDescription>
              Archive, search, and manage your emails with ease
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                <span>Archive emails</span>
              </div>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span>Full-text search</span>
              </div>
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Auto-cleanup</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>Multiple accounts</span>
              </div>
            </div>
            <Button
              onClick={() => signIn('google')}
              className="w-full"
              size="lg"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </Button>
            <p className="text-xs text-gray-500 text-center">
              We&apos;ll access your Gmail to archive your emails securely
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Mail className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">MailStash</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {session.user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                disabled={syncStatus === 'syncing'}
              >
                {syncStatus === 'syncing' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4 mr-2" />
                )}
                {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest email synchronization events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {syncStatus === 'syncing' && (
                  <div className="flex items-center">
                    <Badge variant="secondary" className="mr-2">
                      SYNC
                    </Badge>
                    <span className="text-sm">Email synchronization in progress...</span>
                  </div>
                )}
                {syncStatus === 'error' && syncError && (
                  <div className="flex items-center">
                    <Badge variant="destructive" className="mr-2">
                      ERROR
                    </Badge>
                    <span className="text-sm">{syncError}</span>
                  </div>
                )}
                {stats.lastSync && (
                  <div className="flex items-center">
                    <Badge variant="secondary" className="mr-2">
                      INFO
                    </Badge>
                    <span className="text-sm">
                      Last sync: {new Date(stats.lastSync).toLocaleString()}
                    </span>
                  </div>
                )}
                {stats.totalEmails > 0 && (
                  <div className="flex items-center">
                    <Badge variant="secondary" className="mr-2">
                      INFO
                    </Badge>
                    <span className="text-sm">{stats.totalEmails} emails archived</span>
                  </div>
                )}
                {!stats.lastSync && syncStatus === 'idle' && (
                  <div className="flex items-center">
                    <Badge variant="outline" className="mr-2">
                      INFO
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      No sync activity yet. Click "Sync Now" to start.
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
