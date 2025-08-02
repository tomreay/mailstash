'use client'

import {useState, useEffect, useCallback, FormEvent} from 'react'
import { Mail, ArrowLeft, Search, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmailListItem, EmailsResponse } from '@/types'
import { extractNameFromEmail } from '@/lib/utils/email'

export default function EmailsPage() {
  const router = useRouter()
  const [emails, setEmails] = useState<EmailListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchQuery && { search: searchQuery }),
      })

      const res = await fetch(`/api/emails?${params}`)
      
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/auth/signin')
          return
        }
        throw new Error('Failed to fetch emails')
      }

      const data: EmailsResponse = await res.json()
      setEmails(data.emails)
      setTotalPages(data.totalPages)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emails')
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchQuery, router])

  useEffect(() => {
    void fetchEmails()
  }, [fetchEmails])

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    void fetchEmails()
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mr-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">All Emails</h2>
          <p className="mt-2 text-gray-600">
            {loading ? 'Loading...' : `${total} emails in your archive`}
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Empty State */}
        {!loading && emails.length === 0 && (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No emails found' : 'No emails yet'}
            </h3>
            <p className="text-gray-500">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Sync your email account to see your emails here'}
            </p>
          </div>
        )}

        {/* Email List */}
        {!loading && emails.length > 0 && (
          <>
            <div className="space-y-2">
              {emails.map((email) => {
                const { name, email: emailAddress } = extractNameFromEmail(email.from)
                const date = new Date(email.date)
                
                return (
                  <Card 
                    key={email.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/emails/${email.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`text-sm font-medium truncate ${!email.isRead ? 'font-semibold' : ''}`}>
                              {email.subject || '(No subject)'}
                            </h3>
                            {!email.isRead && (
                              <Badge variant="default" className="text-xs">
                                New
                              </Badge>
                            )}
                            {email.isImportant && (
                              <Badge variant="destructive" className="text-xs">
                                Important
                              </Badge>
                            )}
                            {email.hasAttachments && (
                              <Badge variant="secondary" className="text-xs">
                                📎
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            {name} &lt;{emailAddress}&gt;
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {email.snippet}
                          </p>
                          {email.labels.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              {email.labels.map((label) => (
                                <Badge key={label} variant="secondary" className="text-xs">
                                  {label}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="ml-4 text-sm text-gray-500 whitespace-nowrap">
                          {date.toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {(currentPage - 1) * 20 + 1}-{Math.min(currentPage * 20, total)} of {total} emails
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}