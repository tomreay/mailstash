import { useEffect, useState } from 'react'
import { DryRunStatus } from '@/components/auto-delete-settings'

export function useDryRunStatus(accountId: string | null) {
  const [dryRunStatus, setDryRunStatus] = useState<DryRunStatus | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!accountId) return
    
    const checkDryRunStatus = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/accounts/${accountId}/dry-run-status`)
        if (res.ok) {
          const data = await res.json()
          setDryRunStatus(data)
        }
      } catch (error) {
        console.error('Failed to check dry-run status:', error)
      } finally {
        setLoading(false)
      }
    }
    
    void checkDryRunStatus()
  }, [accountId])

  return { dryRunStatus, setDryRunStatus, loading }
}