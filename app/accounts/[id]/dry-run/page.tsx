import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { DryRunStatus } from './dry-run-status';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DryRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const { id } = await params;

  return (
    <div className='min-h-screen bg-gray-50'>
      <Header />
      <main className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='mb-8'>
          <div className='flex items-center mb-4'>
            <Link href={`/accounts/${id}/settings`}>
              <Button variant='ghost' size='sm'>
                <ArrowLeft className='h-4 w-4 mr-2' />
                Back to Settings
              </Button>
            </Link>
          </div>
          <h2 className='text-3xl font-bold text-gray-900'>
            Auto-Delete Dry Run
          </h2>
          <p className='mt-2 text-gray-600'>
            Test your auto-delete rules without actually deleting any emails
          </p>
        </div>

        <Suspense
          fallback={
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-8 w-8 animate-spin text-gray-400' />
            </div>
          }
        >
          <DryRunStatus accountId={id} />
        </Suspense>
      </main>
    </div>
  );
}
