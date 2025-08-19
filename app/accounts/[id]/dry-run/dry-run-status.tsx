'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { usePolling } from '@/hooks/use-polling';
import { confirmAction } from '@/lib/utils/confirm';
import { POLLING_INTERVAL } from '@/lib/constants/settings';

interface DryRunStatusData {
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  totalEmails?: number;
  processedEmails?: number;
  markedCount?: number;
  error?: string;
}

export function DryRunStatus({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<DryRunStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/dry-run-status`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/auth/signin');
          return;
        }
        throw new Error('Failed to fetch dry-run status');
      }

      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching dry-run status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, [accountId, router]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const shouldPoll =
    status?.status === 'running' || status?.status === 'pending';

  usePolling({
    enabled: shouldPoll,
    interval: POLLING_INTERVAL,
    onPoll: fetchStatus,
  });

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
        setError('Failed to enable auto-delete');
        return;
      }

      router.push(`/accounts/${accountId}/settings`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to enable auto-delete'
      );
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-gray-400' />
      </div>
    );
  }

  const progress =
    status?.totalEmails && status?.processedEmails
      ? (status.processedEmails / status.totalEmails) * 100
      : 0;

  return (
    <>
      {error && (
        <Alert variant='destructive' className='mb-6'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dry Run Status</CardTitle>
          <CardDescription>
            {status?.status === 'pending' &&
              'Dry run is queued and will start soon'}
            {status?.status === 'running' &&
              'Dry run is currently processing your emails'}
            {status?.status === 'completed' && 'Dry run completed successfully'}
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
                  Processing emails...
                </span>
              </div>
              {status.totalEmails && (
                <>
                  <Progress value={progress} className='w-full' />
                  <p className='text-sm text-gray-600'>
                    Processed {status.processedEmails || 0} of{' '}
                    {status.totalEmails} emails
                  </p>
                </>
              )}
            </div>
          )}

          {status?.status === 'completed' && (
            <div className='space-y-4'>
              <div className='flex items-center gap-2 text-green-600'>
                <CheckCircle className='h-5 w-5' />
                <span className='font-medium'>Dry run completed</span>
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
