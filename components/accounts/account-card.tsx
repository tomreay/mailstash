import Link from 'next/link';
import { Settings, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AccountWithStats } from '@/lib/dao/accounts.dao';
import { SyncButton } from './sync-button';
import { SyncStatus } from './sync-status';
import { AccountStats } from './account-stats';
import { getProviderStyle, getSyncStatusStyle } from '@/lib/constants/account-styles';
import * as React from 'react';

interface AccountCardProps {
  account: AccountWithStats;
}

export function AccountCard({ account }: AccountCardProps) {
  const providerStyle = getProviderStyle(account.provider);
  const ProviderIcon = providerStyle.icon;
  const syncStatusStyle = getSyncStatusStyle(account.syncStatus);

  return (
    <Card className='hover:shadow-lg transition-shadow relative overflow-hidden h-full'>
      {/* Status Bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${syncStatusStyle}`} />

      <Link href={`/emails?accountId=${account.id}`}>
        <div className='cursor-pointer'>
          <CardHeader className='pb-4'>
            <div className='flex items-start justify-between'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-gray-100 rounded-lg'>
                  <ProviderIcon className={`h-5 w-5 ${providerStyle.iconColor}`} />
                </div>
                <div>
                  <CardTitle className='text-lg font-semibold'>
                    {account.displayName || account.email}
                  </CardTitle>
                  {account.displayName && (
                    <p className='text-sm text-gray-500'>{account.email}</p>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className='space-y-4'>
            <AccountStats
              emailCount={account.emailCount}
              folderCount={account.folderCount}
              storageUsed={account.storageUsed}
            />

            <SyncStatus
              syncStatus={account.syncStatus}
              lastSyncAt={account.lastSyncAt}
              provider={account.provider}
            />
          </CardContent>
        </div>
      </Link>

      <CardContent className='pt-0'>
        {/* Inactive Warning with Reconnect Button */}
        {!account.isActive && account.provider === 'gmail' && (
          <div className='mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg'>
            <div className='flex items-start gap-2'>
              <div className='flex-1'>
                <p className='text-sm font-medium text-yellow-800'>
                  Account Disconnected
                </p>
                <p className='text-xs text-yellow-700 mt-1'>
                  Reconnect your account to resume syncing
                </p>
              </div>
            </div>
            <Link href='/api/auth/gmail?action=connect' className='block mt-2'>
              <Button
                variant='default'
                size='sm'
                className='w-full bg-yellow-600 hover:bg-yellow-700'
              >
                <RefreshCw className='h-4 w-4 mr-2' />
                Reconnect Account
              </Button>
            </Link>
          </div>
        )}

        {/* Actions */}
        <div className='flex gap-2 pt-2'>
          {account.provider !== 'archive' && (
            <SyncButton
              accountId={account.id}
              isSyncing={account.syncStatus === 'syncing'}
              disabled={!account.isActive}
            />
          )}
          <Link
            href={`/accounts/${account.id}/settings`}
            className={account.provider === 'archive' ? 'flex-1' : ''}
          >
            <Button variant='outline' size='sm' className='w-full'>
              <Settings className='h-4 w-4' />
            </Button>
          </Link>
          <Link href={`/emails?accountId=${account.id}`}>
            <Button variant='ghost' size='sm' className='px-2'>
              <ChevronRight className='h-4 w-4' />
            </Button>
          </Link>
        </div>

        {/* Inactive Badge for non-Gmail accounts */}
        {!account.isActive && account.provider !== 'gmail' && (
          <Badge variant='outline' className='w-full justify-center mt-4'>
            Account Disabled
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
