import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AccountHeaderProps {
  account: {
    displayName: string | null;
    email: string;
    provider: string;
  };
  onDeleteAccount: () => void;
}

export function AccountHeader({
  account,
  onDeleteAccount,
}: AccountHeaderProps) {
  return (
    <div className='mb-8'>
      <div className='flex items-center justify-between mb-4'>
        <Link href='/accounts'>
          <Button variant='ghost' size='sm'>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back to Accounts
          </Button>
        </Link>
        <Button variant='destructive' size='sm' onClick={onDeleteAccount}>
          <Trash2 className='h-4 w-4 mr-2' />
          Delete Account
        </Button>
      </div>
      <h2 className='text-3xl font-bold text-gray-900'>Account Settings</h2>
      <p className='mt-2 text-gray-600'>
        {account.displayName || account.email} ({account.provider})
      </p>
    </div>
  );
}
