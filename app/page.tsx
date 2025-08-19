import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AccountList } from '@/components/accounts/account-list'
import { RecentActivity } from '@/components/recent-activity'
import { QuickActions } from '@/components/quick-actions-card'
import { Header } from '@/components/header'

export default async function Home() {
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
          <h2 className="text-3xl font-bold text-gray-900">Your Email Accounts</h2>
          <p className="mt-2 text-gray-600">
            Manage and view emails from all your connected accounts
          </p>
        </div>

        <AccountList />

        {/* Recent Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <RecentActivity />
          <QuickActions />
        </div>
      </main>
    </div>
  )
}