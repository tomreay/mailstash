'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AccountWithStats } from '@/lib/dao/accounts.dao'

export function useAccounts() {
  const router = useRouter()
  const [accounts, setAccounts] = useState([] as AccountWithStats[])
  const [syncing, setSyncing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch accounts from API
  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/accounts')
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.accounts)
        return data.accounts
      }
      setError('Failed to fetch accounts')
    } catch (err) {
      console.error('Failed to fetch account updates:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

    useEffect(() => {
        void fetchAccounts();
    }, [fetchAccounts]);

  // Poll for updates if any account is syncing
  useEffect(() => {
    // Check if any account is syncing or archive accounts that might be importing
    const hasSyncingAccount = accounts.some(
      account => account.syncStatus === 'syncing' || 
      (account.provider === 'archive' && !account.lastSyncAt && account.syncStatus === 'idle')
    )
    
    if (!hasSyncingAccount) return
    
    // Poll at specified interval
    const interval = setInterval(async () => {
      const updatedAccounts = await fetchAccounts()
      
      if (updatedAccounts) {
        // Stop polling if no accounts are syncing
        const stillSyncing = updatedAccounts.some(
          (account: AccountWithStats) => account.syncStatus === 'syncing'
        )
        if (!stillSyncing) {
          clearInterval(interval)
        }
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [accounts, fetchAccounts])

  // Handle sync for a specific account
  const syncAccount = useCallback(async (accountId: string) => {
    try {
      setSyncing(accountId)
      setError(null)
      
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      })

      if (!res.ok) {
        setError('Failed to start sync')
      }

      // Refresh the data
      await fetchAccounts()
      router.refresh()
      
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sync')
      return false
    } finally {
      setSyncing(null)
    }
  }, [fetchAccounts, router])

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchAccounts()
    router.refresh()
  }, [fetchAccounts, router])

  return {
    accounts,
    syncing,
    error,
    isLoading,
    syncAccount,
    refresh,
    clearError: () => setError(null)
  }
}