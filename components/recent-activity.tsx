'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {SyncJob} from "@/types";

export function RecentActivity() {
  const [syncStatus, setSyncStatus] = useState<string>('idle')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [totalEmails, setTotalEmails] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([])

  const fetchStatus = async () => {
    try {
      const [syncRes, statsRes, jobsRes] = await Promise.all([
        fetch('/api/sync'),
        fetch('/api/stats'),
        fetch('/api/sync-jobs?limit=5')
      ])
      
      if (syncRes.ok) {
        const syncData = await syncRes.json()
        setSyncStatus(syncData.status || 'idle')
      }
      
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setLastSync(statsData.lastSync)
        setTotalEmails(statsData.totalEmails)
      }
      
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json()
        setSyncJobs(jobsData.syncJobs || [])
      }
      
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching status:', error)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Fetch initial status
    void fetchStatus()

    // Poll for updates
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest email synchronization events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest email synchronization events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {syncJobs.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium mb-2">Recent Sync Jobs</div>
              {syncJobs.map((job) => {
                const jobType = job.type.replace('_', ' ').toUpperCase()
                const isProcessing = job.status === 'processing'
                const isCompleted = job.status === 'completed'
                const isFailed = job.status === 'failed'
                
                return (
                  <div key={job.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <Badge 
                        variant={isProcessing ? "default" : isCompleted ? "secondary" : "destructive"} 
                        className="mr-2"
                      >
                        {jobType}
                      </Badge>
                      <span className="text-muted-foreground">
                        {isProcessing && 'In progress...'}
                        {isCompleted && `Completed ${job.emailsProcessed || 0} emails`}
                        {isFailed && (job.error || 'Failed')}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(job.startedAt!).toLocaleTimeString()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {syncStatus === 'syncing' && (
            <div className="flex items-center">
              <Badge variant="secondary" className="mr-2">
                SYNC
              </Badge>
              <span className="text-sm">Email synchronization in progress...</span>
            </div>
          )}
          {syncStatus === 'error' && (
            <div className="flex items-center">
              <Badge variant="destructive" className="mr-2">
                ERROR
              </Badge>
              <span className="text-sm">Sync failed. Please try again.</span>
            </div>
          )}
          {lastSync && (
            <div className="flex items-center">
              <Badge variant="secondary" className="mr-2">
                INFO
              </Badge>
              <span className="text-sm">
                Last sync: {new Date(lastSync).toLocaleString()}
              </span>
            </div>
          )}
          {totalEmails > 0 && (
            <div className="flex items-center">
              <Badge variant="secondary" className="mr-2">
                INFO
              </Badge>
              <span className="text-sm">{totalEmails} emails archived</span>
            </div>
          )}
          {!lastSync && syncStatus === 'idle' && (
            <div className="flex items-center">
              <Badge variant="outline" className="mr-2">
                INFO
              </Badge>
              <span className="text-sm text-muted-foreground">
                No sync activity yet. Click &quot;Sync Now&quot; to start.
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}