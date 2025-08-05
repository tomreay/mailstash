'use client'

import { useRouter } from 'next/navigation'
import { Mail, Activity, Settings } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function QuickActions() {
  const router = useRouter()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>
          Common tasks and navigation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => router.push('/emails')}
        >
          <Mail className="h-4 w-4 mr-2" />
          View All Emails
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => router.push('/jobs')}
        >
          <Activity className="h-4 w-4 mr-2" />
          View Sync Jobs
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => router.push('/accounts')}
        >
          <Settings className="h-4 w-4 mr-2" />
          Manage All Accounts
        </Button>
      </CardContent>
    </Card>
  )
}