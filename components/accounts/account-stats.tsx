import { formatBytes } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/format';

interface AccountStatsProps {
  emailCount: number;
  folderCount: number;
  storageUsed: number;
}

export function AccountStats({ emailCount, folderCount, storageUsed }: AccountStatsProps) {
  return (
    <div className='grid grid-cols-3 gap-4 text-center'>
      <div>
        <p className='text-2xl font-semibold'>{formatNumber(emailCount)}</p>
        <p className='text-xs text-gray-500'>Emails</p>
      </div>
      <div>
        <p className='text-2xl font-semibold'>{formatNumber(folderCount)}</p>
        <p className='text-xs text-gray-500'>Folders</p>
      </div>
      <div>
        <p className='text-2xl font-semibold'>{formatBytes(storageUsed, 0)}</p>
        <p className='text-xs text-gray-500'>Storage</p>
      </div>
    </div>
  );
}