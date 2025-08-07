import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_ACCOUNT_SETTINGS, EmailAccountSettingsClient } from '@/lib/types/account-settings'

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

export function useAccount(accountId: string) {
  const router = useRouter()
  const [account, setAccount] = useState<AccountDetails | null>(null)
  const [settings, setSettings] = useState<EmailAccountSettingsClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAccount = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/accounts/${accountId}`)
      
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/auth/signin')
          return
        }
        setError('Failed to load account')
        return
      }

      const data = await res.json()
      setAccount(data.account)
      
      const accountSettings = data.account?.settings || {
        id: '',
        accountId,
        ...DEFAULT_ACCOUNT_SETTINGS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      setSettings(accountSettings)
    } catch (err) {
      console.error('Error fetching account:', err)
      setError(err instanceof Error ? err.message : 'Failed to load account')
    } finally {
      setLoading(false)
    }
  }, [accountId, router])

  useEffect(() => {
    void fetchAccount()
  }, [fetchAccount])

  return {
    account,
    settings,
    setSettings,
    loading,
    error,
    refetch: fetchAccount
  }
}