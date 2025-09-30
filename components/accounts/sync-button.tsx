'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SyncButtonProps {
  accountId: string;
  isSyncing: boolean;
  disabled?: boolean;
}

export function SyncButton({
  accountId,
  isSyncing: initialSyncing,
  disabled = false,
}: SyncButtonProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(initialSyncing);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      setIsSyncing(true);

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to start sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      variant='outline'
      size='sm'
      className='flex-1'
      onClick={handleSync}
      disabled={isSyncing || disabled}
    >
      {isSyncing ? (
        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
      ) : (
        <RefreshCw className='h-4 w-4 mr-2' />
      )}
      Sync
    </Button>
  );
}
