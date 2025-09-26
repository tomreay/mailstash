import { useMemo } from 'react';
import { Archive, Check, Loader2 } from 'lucide-react';
import { DateDisplay } from '@/components/ui/date-display';

interface Props {
  provider: string;
  lastSyncAt: string | null;
  syncStatus: string;
}

export function SyncStatus(props: Props) {
  const syncStatus = useMemo(() => {
    switch (props.syncStatus) {
      case 'importing':
        return {
          text: 'Importing',
          classes: 'text-blue-600 bg-blue-50',
          icon: <Loader2 className='h-4 w-4 animate-spin' />,
        };
      case 'syncing':
        return {
          text: 'Syncing',
          classes: 'text-blue-600 bg-blue-50',
          icon: <Loader2 className='h-4 w-4 animate-spin' />,
        };
      case 'error':
        return {
          text: props.provider === 'archive' ? 'Import failed' : 'Sync failed',
          classes: 'text-red-600 bd-red-50',
          icon: <Archive className='h-4 w-4' />,
        };
      default:
        return {
          text: props.lastSyncAt ? (
            <DateDisplay date={props.lastSyncAt} format='relative' prefix='Last sync' />
          ) : (
            'Never synced'
          ),
          classes: 'text-green-600 bg-green-50',
          icon: <Check className='h-4 w-4' />,
        };
    }
  }, [props.provider, props.lastSyncAt, props.syncStatus]);

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg ${syncStatus.classes}`}
    >
      <span className='text-sm font-medium'>{syncStatus.text}</span>
      {syncStatus.icon}
    </div>
  );
}
