import { Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SyncFrequencySelector } from '@/components/sync-frequency-selector'
import { AutoDeleteSettings } from '@/components/auto-delete-settings'
import { EmailAccountSettingsClient } from '@/lib/types/account-settings'
import { DryRunStatus } from '@/components/auto-delete-settings'

interface SettingsTabsProps {
  settings: EmailAccountSettingsClient
  setSettings: (settings: EmailAccountSettingsClient) => void
  account: {
    lastSyncAt: string | null
  }
  dryRunStatus: DryRunStatus | null
  isDryRunLoading: boolean
  saving: boolean
  accountId: string
  onSaveSettings: () => void
  onRunDryRun: () => void
  onDisableAutoDelete: () => void
}

export function SettingsTabs({
  settings,
  setSettings,
  account,
  dryRunStatus,
  isDryRunLoading,
  saving,
  accountId,
  onSaveSettings,
  onRunDryRun,
  onDisableAutoDelete
}: SettingsTabsProps) {
  return (
    <>
      <Tabs defaultValue="sync" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sync">Sync Settings</TabsTrigger>
          <TabsTrigger value="deletion">Auto-Delete</TabsTrigger>
        </TabsList>

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
                accountId={accountId}
                mode={settings.autoDeleteMode}
                deleteDelayHours={settings.deleteDelayHours}
                deleteAgeMonths={settings.deleteAgeMonths}
                deleteOnlyArchived={settings.deleteOnlyArchived}
                dryRunStatus={dryRunStatus}
                isLoading={isDryRunLoading}
                onModeChange={(mode) => setSettings({ ...settings, autoDeleteMode: mode })}
                onDelayChange={(hours) => setSettings({ ...settings, deleteDelayHours: hours })}
                onAgeChange={(months) => setSettings({ ...settings, deleteAgeMonths: months })}
                onArchivedOnlyChange={(archived) => setSettings({ ...settings, deleteOnlyArchived: archived })}
                onRunDryRun={onRunDryRun}
                onDisableAutoDelete={onDisableAutoDelete}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end">
        <Button 
          onClick={onSaveSettings}
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
    </>
  )
}