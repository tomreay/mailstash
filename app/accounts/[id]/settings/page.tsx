'use client'

import {useCallback, useEffect, useState} from 'react'
import {AlertCircle, ArrowLeft, Loader2, Mail, Save, Trash2} from 'lucide-react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {SyncFrequencySelector} from '@/components/sync-frequency-selector'
import {AutoDeleteSettings} from '@/components/auto-delete-settings'
import {DEFAULT_ACCOUNT_SETTINGS, EmailAccountSettingsClient} from '@/lib/types/account-settings'

interface AccountDetails {
  id: string
  email: string
  displayName: string | null
  provider: string
  isActive: boolean
  emailCount: number
  folderCount: number
  filterRuleCount: number
  storageUsed: number
  lastSyncAt: string | null
  syncStatus: string
  createdAt: string
  settings: EmailAccountSettingsClient
}



export default function AccountSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  return <AccountSettingsWrapper params={params} />
}

function AccountSettingsWrapper({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null)
  
  useEffect(() => {
    params.then(p => setId(p.id))
  }, [params])
  
  if (!id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
  
  return <AccountSettingsContent id={id} />
}

function AccountSettingsContent({ id }: { id: string }) {
  const router = useRouter()
  const [account, setAccount] = useState<AccountDetails | null>(null)
  const [settings, setSettings] = useState<EmailAccountSettingsClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fetchAccount = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/accounts/${id}`)
      
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/auth/signin')
          return
        }
        throw new Error('Failed to fetch account')
      }

      const data = await res.json()
      console.log('Account data received:', data)
      setAccount(data.account)
      
      // If settings don't exist, create default values
      if (data.account?.settings) {
        setSettings(data.account.settings)
      } else {
        // Set default settings if none exist
        setSettings({
          id: '',
          accountId: id,
          ...DEFAULT_ACCOUNT_SETTINGS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('Error fetching account:', err)
      setError(err instanceof Error ? err.message : 'Failed to load account')
    } finally {
      setLoading(false)
    }
  }, [id, router])


  useEffect(() => {
    void fetchAccount()
  }, [fetchAccount])

  const handleSaveSettings = async () => {
    if (!settings) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const res = await fetch(`/api/accounts/${id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncFrequency: settings.syncFrequency,
          syncPaused: settings.syncPaused,
          autoDeleteEnabled: settings.autoDeleteEnabled,
          deleteDelayHours: settings.deleteDelayHours,
          deleteAgeMonths: settings.deleteAgeMonths,
          deleteOnlyArchived: settings.deleteOnlyArchived
        })
      })

      if (!res.ok) {
        throw new Error('Failed to save settings')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete this account? This will delete all associated emails and data.')) {
      return
    }

    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Failed to delete account')
      }

      router.push('/accounts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }


  if (loading || !account || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <Mail className="h-8 w-8 text-blue-600 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">MailStash</h1>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/accounts">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Accounts
              </Button>
            </Link>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDeleteAccount}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Account Settings</h2>
          <p className="mt-2 text-gray-600">
            {account.displayName || account.email} ({account.provider})
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">Settings saved successfully!</p>
          </div>
        )}

        {/* Settings Tabs */}
        <Tabs defaultValue="sync" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sync">Sync Settings</TabsTrigger>
            <TabsTrigger value="deletion">Auto-Delete</TabsTrigger>
          </TabsList>

          {/* Sync Settings */}
          <TabsContent value="sync">
            <Card>
              <CardHeader>
                <CardTitle>Sync Configuration</CardTitle>
                <CardDescription>
                  Control how often your emails are synchronized
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SyncFrequencySelector
                  frequency={settings.syncFrequency}
                  isPaused={settings.syncPaused}
                  lastSyncAt={account.lastSyncAt}
                  onFrequencyChange={(freq) => setSettings({ ...settings, syncFrequency: freq })}
                  onPausedChange={(paused) => setSettings({ ...settings, syncPaused: paused })}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Auto-Delete Settings */}
          <TabsContent value="deletion">
            <Card>
              <CardHeader>
                <CardTitle>Auto-Delete Configuration</CardTitle>
                <CardDescription>
                  Automatically remove old emails to save storage space
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AutoDeleteSettings
                  enabled={settings.autoDeleteEnabled}
                  deleteDelayHours={settings.deleteDelayHours}
                  deleteAgeMonths={settings.deleteAgeMonths}
                  deleteOnlyArchived={settings.deleteOnlyArchived}
                  onEnabledChange={(enabled) => setSettings({ ...settings, autoDeleteEnabled: enabled })}
                  onDelayChange={(hours) => setSettings({ ...settings, deleteDelayHours: hours })}
                  onAgeChange={(months) => setSettings({ ...settings, deleteAgeMonths: months })}
                  onArchivedOnlyChange={(archived) => setSettings({ ...settings, deleteOnlyArchived: archived })}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <Button 
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </main>
    </div>
  )
}