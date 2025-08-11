import {auth} from '@/lib/auth'
import {redirect} from 'next/navigation'
import Link from 'next/link'
import {ArrowLeft, Plus} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Header} from '@/components/header'
import {AccountList} from "@/components/accounts/account-list";

export default async function AccountsPage() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={session.user} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <Link href="/accounts/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </Link>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Email Accounts</h2>
          <p className="mt-2 text-gray-600">
            Manage your connected email accounts and their settings
          </p>
        </div>

        <AccountList />
      </main>
    </div>
  )
}