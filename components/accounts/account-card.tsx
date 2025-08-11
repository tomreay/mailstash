import { Mail, Settings, RefreshCw, Loader2, ChevronRight, Archive, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/utils'
import { AccountWithStats } from '@/lib/dao/accounts.dao'
import {useMemo} from "react";
import {SyncStatus} from "@/components/accounts/sync-status";

interface AccountCardProps {
  account: AccountWithStats
  isSyncing: boolean
  onSync: (e: React.MouseEvent) => void
  onClick: () => void
  onSettings: (e: React.MouseEvent) => void
}

export function AccountCard({ 
  account, 
  isSyncing, 
  onSync, 
  onClick, 
  onSettings 
}: AccountCardProps) {
    const providerIcon = useMemo(() => {
        if (account.provider === 'gmail') {
          return <Mail className="h-5 w-5 text-red-600" />
        } else if (account.provider === 'archive') {
          return <Archive className="h-5 w-5 text-purple-600" />
        } else {
            return <Mail className="h-5 w-5 text-blue-600"/>
        }
    }, [account.provider])

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow relative overflow-hidden"
      onClick={onClick}
    >
      {/* Status Bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        account.syncStatus === 'syncing' ? 'bg-blue-600 animate-pulse' :
        account.syncStatus === 'error' ? 'bg-red-600' :
        'bg-green-600'
      }`} />
      
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              {providerIcon}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                {account.displayName || account.email}
              </CardTitle>
              {account.displayName && (
                <p className="text-sm text-gray-500">{account.email}</p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold">{account.emailCount.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Emails</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{account.folderCount}</p>
            <p className="text-xs text-gray-500">Folders</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{formatBytes(account.storageUsed, 0)}</p>
            <p className="text-xs text-gray-500">Storage</p>
          </div>
        </div>

        <SyncStatus syncStatus={account.syncStatus} lastSyncAt={account.lastSyncAt} provider={account.provider} />

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {account.provider !== 'archive' && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onSync}
              disabled={isSyncing || account.syncStatus === 'syncing'}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onSettings}
            className={account.provider === 'archive' ? 'flex-1' : ''}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Inactive Badge */}
        {!account.isActive && (
          <Badge variant="outline" className="w-full justify-center">
            Account Disabled
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}