'use client'

import { useState } from 'react'
import { Mail, ArrowLeft, Loader2, Server, Shield } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { signIn } from 'next-auth/react'

type Provider = 'gmail' | 'imap'

interface ImapConfig {
  host: string
  port: string
  secure: boolean
  user: string
  pass: string
  email: string
  displayName: string
}

export default function NewAccountPage() {
  const router = useRouter()
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // IMAP form state
  const [imapConfig, setImapConfig] = useState<ImapConfig>({
    host: '',
    port: '993',
    secure: true,
    user: '',
    pass: '',
    email: '',
    displayName: ''
  })

  const handleGmailConnect = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Sign in with Google - this will create the account automatically
      await signIn('google', { callbackUrl: '/accounts' })
    } catch {
      setError('Failed to connect with Google. Please try again.')
      setLoading(false)
    }
  }

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
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Link href="/accounts">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Accounts
              </Button>
            </Link>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Add Email Account</h2>
          <p className="mt-2 text-gray-600">
            Connect your email account to start archiving your emails
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Provider Selection */}
        {!selectedProvider && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedProvider('gmail')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Mail className="h-6 w-6 text-red-600" />
                  </div>
                  Gmail
                </CardTitle>
                <CardDescription>
                  Connect your Gmail account using secure OAuth authentication
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  • Secure authentication via Google
                </p>
                <p className="text-sm text-gray-600">
                  • Automatic sync configuration
                </p>
                <p className="text-sm text-gray-600">
                  • Access to labels and folders
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedProvider('imap')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Server className="h-6 w-6 text-blue-600" />
                  </div>
                  IMAP Server
                </CardTitle>
                <CardDescription>
                  Connect any email account that supports IMAP
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  • Works with any IMAP provider
                </p>
                <p className="text-sm text-gray-600">
                  • Manual server configuration
                </p>
                <p className="text-sm text-gray-600">
                  • Support for custom domains
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Gmail Connection */}
        {selectedProvider === 'gmail' && (
          <Card>
            <CardHeader>
              <CardTitle>Connect Gmail Account</CardTitle>
              <CardDescription>
                You&apos;ll be redirected to Google to authorize MailStash to access your emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Secure Authentication</p>
                    <p className="text-sm text-blue-700 mt-1">
                      We use OAuth 2.0 for secure authentication. Your password is never shared with MailStash.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedProvider(null)}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  onClick={handleGmailConnect}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Connect with Google
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* IMAP Configuration */}
        {selectedProvider === 'imap' && (
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
                <Button
                  variant="outline"
                  onClick={() => setSelectedProvider(null)}
                  disabled={loading}
                >
                  Back
                </Button>
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
        )}
      </main>
    </div>
  )
}