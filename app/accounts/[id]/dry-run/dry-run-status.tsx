'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Clock, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { confirmAction } from '@/lib/utils/confirm';
import { useDryRunStatus } from '@/hooks/use-dry-run-status';

export function DryRunStatus({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [localError, setLocalError] = useState<string | null>(null);

  const { dryRunStatus: status, error, isLoading } = useDryRunStatus(accountId);

  const handleConfirmAutoDelete = async () => {
    const confirmed = confirmAction(
      'Are you sure you want to enable auto-delete? This will permanently delete emails from your mail server based on your configured rules.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/accounts/${accountId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoDeleteMode: 'on' }),
      });

      if (!res.ok) {
        setLocalError('Failed to enable auto-delete');
        return;
      }

      router.push(`/accounts/${accountId}/settings`);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Failed to enable auto-delete'
      );
    }
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-gray-400' />
      </div>
    );
  }

  const displayError = localError || error;

  return (
    <>
      {displayError && (
        <Alert variant='destructive' className='mb-6'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dry Run Status</CardTitle>
          <CardDescription>
            {status?.status === 'pending' &&
              'Dry run is queued and will start soon'}
            {status?.status === 'running' &&
              'Analyzing your emails against deletion rules'}
            {status?.status === 'completed' && 'Dry run analysis completed'}
            {status?.status === 'failed' && 'Dry run failed to complete'}
            {!status && 'No dry run has been triggered yet'}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {status?.status === 'running' && (
            <div className='space-y-4'>
              <div className='flex items-center gap-2'>
                <Loader2 className='h-5 w-5 animate-spin text-blue-600' />
                <span className='text-sm font-medium'>
                  Analyzing emails against your deletion rules...
                </span>
              </div>
              <p className='text-sm text-gray-600'>
                This may take a few moments depending on the number of emails in your account
              </p>
            </div>
          )}

          {status?.status === 'completed' && (
            <div className='space-y-4'>
              <div className='flex items-center gap-2 text-green-600'>
                <CheckCircle className='h-5 w-5' />
                <span className='font-medium'>Analysis complete</span>
              </div>

              {status.markedCount !== undefined && (
                <Alert>
                  <Trash2 className='h-4 w-4' />
                  <AlertTitle>Results</AlertTitle>
                  <AlertDescription>
                    {status.markedCount === 0 ? (
                      'No emails match your auto-delete rules'
                    ) : (
                      <>
                        {status.markedCount} email
                        {status.markedCount === 1 ? '' : 's'} would be deleted
                        {status.markedCount > 0 && (
                          <Link
                            href={`/emails?filter=marked-for-deletion&accountId=${accountId}`}
                            className='block mt-2 text-blue-600 hover:underline'
                          >
                            View marked emails →
                          </Link>
                        )}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {status.completedAt && (
                <p className='text-sm text-gray-600'>
                  Completed at {new Date(status.completedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {status?.status === 'failed' && (
            <Alert variant='destructive'>
              <AlertCircle className='h-4 w-4' />
              <AlertTitle>Dry run failed</AlertTitle>
              <AlertDescription>
                {status.error || 'An unknown error occurred during the dry run'}
              </AlertDescription>
            </Alert>
          )}

          {status?.status === 'pending' && (
            <div className='flex items-center gap-2'>
              <Clock className='h-5 w-5 text-gray-400' />
              <span className='text-sm text-gray-600'>Waiting in queue...</span>
            </div>
          )}

          <div className='flex gap-3'>
            {status?.status === 'completed' &&
              status.markedCount &&
              status.markedCount > 0 && (
                <>
                  <Button
                    variant='destructive'
                    onClick={handleConfirmAutoDelete}
                  >
                    Enable Auto-Delete
                  </Button>
                  <Link href={`/accounts/${accountId}/settings`}>
                    <Button variant='outline'>Adjust Settings</Button>
                  </Link>
                </>
              )}

            {status?.status === 'completed' && status.markedCount === 0 && (
              <>
                <Link href={`/accounts/${accountId}/settings`}>
                  <Button>Adjust Settings</Button>
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
