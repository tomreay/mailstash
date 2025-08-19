import { AccountsService } from '@/lib/services/accounts.service'
import { AccountCard } from './account-card'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export async function AccountList() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const accounts = await AccountsService.getUserAccountsWithStats(session.user.id)

  if (accounts.length === 0) {
    return (
      <Card className="mb-8">
        <CardContent className="text-center py-12">
          <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="h-6 w-6 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No email accounts connected
          </h3>
          <p className="text-gray-500 mb-4">
            Connect an email account to start archiving your emails
          </p>
          <Link href="/accounts/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Account
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Add Account Card */}
      <Link href="/accounts/new">
        <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 cursor-pointer transition-colors h-full">
          <CardContent className="justify-center items-center flex flex-col h-full py-8">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-gray-600" />
            </div>
            <CardTitle className="text-lg">Add Email Account</CardTitle>
            <CardDescription>
              Connect a new email account to start archiving
            </CardDescription>
          </CardContent>
        </Card>
      </Link>

      {/* Account Cards */}
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
        />
      ))}
    </div>
  )
}