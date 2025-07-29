import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Mail } from 'lucide-react'
import { StatsCards } from '@/components/stats-cards'
import { QuickActions } from '@/components/quick-actions'
import { RecentActivity } from '@/components/recent-activity'
import { UserNav } from '@/components/user-nav'

export default async function Home() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Mail className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">MailStash</h1>
            </div>
            <UserNav user={session.user} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="mt-2 text-gray-600">
            Welcome back, {session.user.name || session.user.email}
          </p>
        </div>

        {/* Stats Cards - Self-contained server component */}
        <StatsCards />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Quick Actions - Self-contained client component */}
          <QuickActions />
          
          {/* Recent Activity - Self-contained client component */}
          <RecentActivity />
        </div>
      </main>
    </div>
  )
}