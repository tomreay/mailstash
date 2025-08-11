'use client'

import { useState } from 'react'
import { Server, ArrowLeft, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AccountCreationLayout } from '@/components/account-creation-layout'

interface ImapConfig {
  host: string
  port: string
  secure: boolean
  user: string
  pass: string
  email: string
  displayName: string
}

export default function ImapAccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [imapConfig, setImapConfig] = useState<ImapConfig>({
    host: '',
    port: '993',
    secure: true,
    user: '',
    pass: '',
    email: '',
    displayName: ''
  })

  const handleImapConnect = async () => {
    try {
      setLoading(true)
      setError(null)

      // Validate form
      if (!imapConfig.host || !imapConfig.user || !imapConfig.pass || !imapConfig.email) {
        setError('Please fill in all required fields')
        setLoading(false)
        return
      }

      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'imap',
          email: imapConfig.email,
          displayName: imapConfig.displayName || imapConfig.email,
          imapConfig: {
            host: imapConfig.host,
            port: parseInt(imapConfig.port),
            secure: imapConfig.secure,
            user: imapConfig.user,
            pass: imapConfig.pass
          }
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add account')
      }

      // Success - redirect to accounts page
      router.push('/accounts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account')
      setLoading(false)
    }
  }

  return (
    <AccountCreationLayout
      title="Configure IMAP Account"
      description="Connect any email account that supports IMAP"
      error={error}
    >
      <Card>
        <CardHeader>
          <CardTitle>Configure IMAP Account</CardTitle>
          <CardDescription>
            Enter your email server details to connect your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={imapConfig.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImapConfig({ ...imapConfig, email: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="My Work Email"
                value={imapConfig.displayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImapConfig({ ...imapConfig, displayName: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="host">IMAP Server *</Label>
              <Input
                id="host"
                placeholder="imap.example.com"
                value={imapConfig.host}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImapConfig({ ...imapConfig, host: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="port">Port *</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="993"
                  value={imapConfig.port}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImapConfig({ ...imapConfig, port: e.target.value })}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="secure">Security</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="secure"
                    checked={imapConfig.secure}
                    onCheckedChange={(checked: boolean) => setImapConfig({ ...imapConfig, secure: checked })}
                    disabled={loading}
                  />
                  <Label htmlFor="secure" className="font-normal">
                    Use SSL/TLS
                  </Label>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user">Username *</Label>
              <Input
                id="user"
                placeholder="username or email"
                value={imapConfig.user}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImapConfig({ ...imapConfig, user: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pass">Password *</Label>
              <Input
                id="pass"
                type="password"
                placeholder="••••••••"
                value={imapConfig.pass}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImapConfig({ ...imapConfig, pass: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> For Gmail accounts, you&apos;ll need to use an app-specific password. 
              For other providers, ensure IMAP access is enabled in your email settings.
            </p>
          </div>

          <div className="flex gap-3">
            <Link href="/accounts/new">
              <Button
                variant="outline"
                disabled={loading}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Button
              onClick={handleImapConnect}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Server className="h-4 w-4 mr-2" />
              )}
              Connect Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </AccountCreationLayout>
  )
}