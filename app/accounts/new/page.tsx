'use client'

import { Mail, Server, Archive } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AccountCreationLayout } from '@/components/account-creation-layout'
import { AccountProviderCard } from '@/components/account-provider-card'

export default function NewAccountPage() {
  const router = useRouter()

  return (
    <AccountCreationLayout>
      <div className="grid gap-6 md:grid-cols-3">
        <AccountProviderCard
          icon={<Mail className="h-6 w-6 text-red-600" />}
          iconBgColor="bg-red-100"
          title="Gmail"
          description="Connect your Gmail account using secure OAuth authentication"
          features={[
            'Secure authentication via Google',
            'Automatic sync configuration',
            'Access to labels and folders'
          ]}
          onClick={() => router.push('/accounts/new/gmail')}
        />

        <AccountProviderCard
          icon={<Server className="h-6 w-6 text-blue-600" />}
          iconBgColor="bg-blue-100"
          title="IMAP Server"
          description="Connect any email account that supports IMAP"
          features={[
            'Works with any IMAP provider',
            'Manual server configuration',
            'Support for custom domains'
          ]}
          onClick={() => router.push('/accounts/new/imap')}
        />

        <AccountProviderCard
          icon={<Archive className="h-6 w-6 text-purple-600" />}
          iconBgColor="bg-purple-100"
          title="Email Archive"
          description="Import emails from an mbox file"
          features={[
            'One-time import (no sync)',
            'Perfect for old accounts',
            'Supports standard mbox format'
          ]}
          onClick={() => router.push('/accounts/new/archive')}
        />
      </div>
    </AccountCreationLayout>
  )
}