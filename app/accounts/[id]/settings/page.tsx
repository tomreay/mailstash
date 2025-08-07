'use client'

import { use } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { MessageAlert } from '@/components/ui/message-alert'
import { Header } from '@/components/layout/header'
import { AccountHeader } from '@/components/account-header'
import { SettingsTabs } from '@/components/settings-tabs'
import { useAccount } from '@/hooks/use-account'
import { useDryRunStatus } from '@/hooks/use-dry-run-status'
import { useSettingsManager } from '@/hooks/use-settings-manager'

export default function AccountSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <AccountSettingsContent id={id} />
}

function AccountSettingsContent({ id }: { id: string }) {
  const { account, settings, setSettings, loading, error: fetchError } = useAccount(id)
  const { dryRunStatus, setDryRunStatus } = useDryRunStatus(id)
  const {
    saving,
    error,
    success,
    isDryRunLoading,
    handleSaveSettings,
    handleRunDryRun,
    handleDisableAutoDelete,
    handleDeleteAccount
  } = useSettingsManager({ 
    accountId: id, 
    settings, 
    setSettings,
    setDryRunStatus 
  })

  if (loading || !account || !settings) {
    return <LoadingSpinner fullScreen />
  }

  const displayError = error || fetchError

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AccountHeader 
          account={account}
          onDeleteAccount={handleDeleteAccount}
        />

        {displayError && (
          <MessageAlert 
            type="error" 
            message={displayError} 
            className="mb-6"
          />
        )}
        
        {success && (
          <MessageAlert 
            type="success" 
            message="Settings saved successfully!" 
            className="mb-6"
          />
        )}

        <SettingsTabs
          settings={settings}
          setSettings={setSettings}
          account={account}
          dryRunStatus={dryRunStatus}
          isDryRunLoading={isDryRunLoading}
          saving={saving}
          accountId={id}
          onSaveSettings={handleSaveSettings}
          onRunDryRun={handleRunDryRun}
          onDisableAutoDelete={handleDisableAutoDelete}
        />
      </main>
    </div>
  )
}