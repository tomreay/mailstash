'use client'

import {Archive, Calendar, Clock, AlertCircle, Info, Trash2, Loader2, ExternalLink, FlaskConical} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { AutoDeleteMode } from '@/lib/types/account-settings'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useMemo } from 'react'
import { DELAY_PRESETS, AGE_PRESETS } from '@/lib/constants/settings'

export interface DryRunStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | null
  markedCount?: number
}

interface AutoDeleteSettingsProps {
  accountId: string
  mode: AutoDeleteMode
  deleteDelayHours: number | null
  deleteAgeMonths: number | null
  deleteOnlyArchived: boolean
  dryRunStatus: DryRunStatus | null
  isLoading?: boolean
  onModeChange: (mode: AutoDeleteMode) => void
  onDelayChange: (hours: number | null) => void
  onAgeChange: (months: number | null) => void
  onArchivedOnlyChange: (archivedOnly: boolean) => void
  onRunDryRun: () => void
  onDisableAutoDelete: () => void
  className?: string
}

export function AutoDeleteSettings({
  accountId,
  mode,
  deleteDelayHours,
  deleteAgeMonths,
  deleteOnlyArchived,
  dryRunStatus,
  isLoading = false,
  onDelayChange,
  onAgeChange,
  onArchivedOnlyChange,
  onRunDryRun,
  onDisableAutoDelete,
  className
}: AutoDeleteSettingsProps) {

  const deleteSummary = useMemo(() => {
    const conditions: string[] = []
    
    if (deleteDelayHours !== null) {
      const preset = DELAY_PRESETS.find(p => p.hours === deleteDelayHours)
      conditions.push(`${preset?.label || `${deleteDelayHours} hours`} after import`)
    }
    
    if (deleteAgeMonths !== null) {
      const preset = AGE_PRESETS.find(p => p.months === deleteAgeMonths)
      conditions.push(`older than ${preset?.label || `${deleteAgeMonths} months`}`)
    }
    
    if (deleteOnlyArchived) {
      conditions.push('archived only')
    }
    
    return conditions.length === 0 
      ? 'No deletion rules configured'
      : `Delete emails: ${conditions.join(', ')}`
  }, [deleteDelayHours, deleteAgeMonths, deleteOnlyArchived])

  const hasValidRules = deleteDelayHours !== null || deleteAgeMonths !== null

  if (mode === 'on') {
    return (
      <div className={cn("space-y-6", className)}>
        <Alert>
          <Trash2 className="h-4 w-4" />
          <AlertTitle>Auto-Delete Active</AlertTitle>
          <AlertDescription>
            {deleteSummary}
          </AlertDescription>
        </Alert>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">Auto-Delete is Active</p>
              <p className="text-sm text-amber-700 mt-1">
                Emails matching your rules are being permanently deleted during each sync.
                To change settings, you must first disable auto-delete.
              </p>
            </div>
          </div>
        </div>

        <Button 
          variant="destructive" 
          onClick={onDisableAutoDelete}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Disabling...
            </>
          ) : (
            'Disable Auto-Delete'
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          {dryRunStatus ? (
            <div>
              <p className="text-sm font-medium text-blue-900 mb-4">Complete auto-delete setup:</p>
              <Link href={`/accounts/${accountId}/dry-run`}>
                <Button className="w-full" variant="secondary">
                  {dryRunStatus.status === 'completed' ? 'View Dry-Run Results' : 'View Dry-Run Progress'}
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-blue-900">Configure Auto-Delete Rules</p>
              <p className="text-sm text-blue-700 mt-1">
                Set up your deletion rules below. You&apos;ll be able to preview which emails would be deleted before enabling auto-delete.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <Label>Deletion Rules</Label>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <Label className="text-sm font-normal">Delete after import delay</Label>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {DELAY_PRESETS.slice(0, 4).map(preset => (
              <Button
                key={preset.hours}
                variant={deleteDelayHours === preset.hours ? "default" : "outline"}
                size="sm"
                onClick={() => onDelayChange(preset.hours)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              placeholder="Custom hours"
              value={deleteDelayHours ?? ''}
              onChange={(e) => onDelayChange(e.target.value ? parseInt(e.target.value) : null)}
              className="w-36"
            />
            <span className="text-sm text-gray-500">hours after import</span>
            {deleteDelayHours !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelayChange(null)}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <Label className="text-sm font-normal">Delete by email age</Label>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {AGE_PRESETS.slice(0, 4).map(preset => (
              <Button
                key={preset.months}
                variant={deleteAgeMonths === preset.months ? "default" : "outline"}
                size="sm"
                onClick={() => onAgeChange(preset.months)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              placeholder="Custom months"
              value={deleteAgeMonths ?? ''}
              onChange={(e) => onAgeChange(e.target.value ? parseInt(e.target.value) : null)}
              className="w-36"
            />
            <span className="text-sm text-gray-500">months old</span>
            {deleteAgeMonths !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAgeChange(null)}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="archived-only"
              checked={deleteOnlyArchived}
              onCheckedChange={(checked) => onArchivedOnlyChange(checked as boolean)}
            />
            <Label htmlFor="archived-only" className="text-sm font-normal cursor-pointer">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-gray-400" />
                Only delete archived emails
              </div>
            </Label>
          </div>
        </div>
      </div>

      {hasValidRules && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Trash2 className="h-4 w-4 text-gray-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Rule Summary</p>
              <p className="text-sm text-gray-600">{deleteSummary}</p>
            </div>
          </div>
        </div>
      )}

      {hasValidRules ? (
        <Button 
          onClick={onRunDryRun}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting Dry-Run...
            </>
          ) : (
            <>
              <FlaskConical className="h-4 w-4 mr-2" />
              Save & Start {dryRunStatus && 'New'} Dry-Run
            </>
          )}
        </Button>
      ) : (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600">
            Please configure at least one deletion rule to continue.
          </p>
        </div>
      )}
    </div>
  )
}