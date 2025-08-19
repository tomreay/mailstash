import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import { EmailList } from '@/components/email-list';
import { EmailsService } from '@/lib/services/emails.service';
import { AccountsService } from '@/lib/services/accounts.service';

interface EmailsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    accountId?: string;
    filter?: string;
  }>;
}

export default async function EmailsPage({ searchParams }: EmailsPageProps) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/auth/signin');
  }

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search || '';
  const accountId = params.accountId || undefined;
  const filter = params.filter || undefined;

  // Fetch emails server-side
  const emailsData = await EmailsService.getUserEmails(session.user.id!, {
    page,
    limit: 20,
    search,
    accountId,
    filter,
  });

  // Fetch account details if accountId is provided
  let accountName: string | null = null;
  if (accountId) {
    try {
      const account = await AccountsService.getAccountDetails(
        accountId,
        session.user.id!
      );
      accountName = account.displayName || account.email;
    } catch (err) {
      console.error('Failed to fetch account details:', err);
    }
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <Header user={session.user} />

      {/* Main Content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='mb-8'>
          <div className='flex items-center mb-4'>
            <Link href='/'>
              <Button variant='ghost' size='sm' className='mr-4'>
                <ArrowLeft className='h-4 w-4 mr-2' />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <h2 className='text-3xl font-bold text-gray-900'>
            {filter === 'marked-for-deletion'
              ? 'Emails Marked for Deletion'
              : accountName
                ? `${accountName} Emails`
                : 'All Emails'}
          </h2>
          <p className='mt-2 text-gray-600'>
            {filter === 'marked-for-deletion'
              ? `${emailsData.total} emails marked for deletion`
              : `${emailsData.total} emails${accountName ? ' in this account' : ' in your archive'}`}
          </p>
        </div>

        {/* Email List with Search and Pagination */}
        <EmailList
          initialEmails={emailsData.emails}
          total={emailsData.total}
          totalPages={emailsData.totalPages}
          currentPage={page}
          searchQuery={search}
          accountId={accountId}
          filter={filter}
        />
      </main>
    </div>
  );
}
