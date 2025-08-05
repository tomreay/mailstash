'use client'

import {useEffect, useState} from 'react'
import {AlertCircle, Calendar, Clock, Info, Play} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Switch} from '@/components/ui/switch'
import {cn} from '@/lib/utils'
import parser from 'cron-parser'
import cronstrue from 'cronstrue'

interface SyncFrequencySelectorProps {
  frequency: string
  isPaused: boolean
  lastSyncAt?: string | null
  onFrequencyChange: (frequency: string) => void
  onPausedChange: (paused: boolean) => void
  onManualSync?: () => Promise<void>
  className?: string
}

const PRESET_FREQUENCIES = [
  { value: 'manual', label: 'Manual only', description: 'No automatic syncing' },
  { value: '*/15 * * * *', label: 'Every 15 minutes', description: 'Four times per hour' },
  { value: '*/30 * * * *', label: 'Every 30 minutes', description: 'Twice per hour' },
  { value: '0 * * * *', label: 'Every hour', description: 'At the start of each hour' },
  { value: '0 */2 * * *', label: 'Every 2 hours', description: '12 times per day' },
  { value: '0 */6 * * *', label: 'Every 6 hours', description: '4 times per day' },
  { value: '0 */12 * * *', label: 'Every 12 hours', description: 'Twice per day' },
  { value: '0 0 * * *', label: 'Daily at midnight', description: 'Once per day at 00:00' },
  { value: '0 2 * * *', label: 'Daily at 2 AM', description: 'Once per day at 02:00' },
  { value: '0 0 * * 1', label: 'Weekly on Monday', description: 'Once per week' },
  { value: '0 0 * * 0', label: 'Weekly on Sunday', description: 'Once per week' },
  { value: '0 0 1 * *', label: 'Monthly', description: 'First day of each month' },
  { value: 'custom', label: 'Custom expression', description: 'Enter your own cron expression' },
]

function parseCronExpression(expression: string): string | null {
  if (expression === 'manual') {
    return 'Manual sync only - no automatic synchronization'
  }

  try {
    // Use cronstrue for human-readable descriptions
    return cronstrue.toString(expression, { 
      throwExceptionOnParseError: false,
      use24HourTimeFormat: false 
    })
  } catch {
    return null
  }
}

function validateCronExpression(expression: string): boolean {
  if (expression === 'manual') return true
  
  try {
    // Use cron-parser for validation
    parser.parse(expression)
    return true
  } catch {
    return false
  }
}

export function SyncFrequencySelector({
  frequency,
  isPaused,
  lastSyncAt,
  onFrequencyChange,
  onPausedChange,
  onManualSync,
  className
}: SyncFrequencySelectorProps) {
  const [syncing, setSyncing] = useState(false)
  const [customExpression, setCustomExpression] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    const isPreset = PRESET_FREQUENCIES.some(preset => preset.value === frequency)
    if (!isPreset && frequency !== 'manual') {
      setIsCustomMode(true)
      setCustomExpression(frequency)
    } else {
      setIsCustomMode(false)
      setCustomExpression('')
    }
  }, [frequency])

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomMode(true)
      setCustomExpression(frequency === 'manual' ? '0 * * * *' : frequency)
    } else {
      setIsCustomMode(false)
      onFrequencyChange(value)
      setValidationError(null)
    }
  }

  const handleCustomExpressionChange = (value: string) => {
    setCustomExpression(value)
    
    if (validateCronExpression(value)) {
      onFrequencyChange(value)
      setValidationError(null)
    } else {
      setValidationError('Invalid cron expression. Format: minute hour day month weekday')
    }
  }

  const handleManualSync = async () => {
    if (!onManualSync) return
    
    try {
      setSyncing(true)
      await onManualSync()
    } finally {
      setSyncing(false)
    }
  }

  const currentPreset = isCustomMode 
    ? 'custom' 
    : PRESET_FREQUENCIES.find(p => p.value === frequency)?.value || 'custom'

  const cronDescription = parseCronExpression(frequency)

  return (
    <div className={cn("space-y-6", className)}>
      {/* Pause/Resume Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="sync-paused">Pause Synchronization</Label>
          <p className="text-sm text-gray-500">
            Temporarily stop automatic email synchronization
          </p>
        </div>
        <Switch
          id="sync-paused"
          checked={isPaused}
          onCheckedChange={onPausedChange}
        />
      </div>

      {/* Frequency Selection */}
      <div className="space-y-2">
        <Label htmlFor="sync-frequency">Sync Frequency</Label>
        <Select
          value={currentPreset}
          onValueChange={handlePresetChange}
          disabled={isPaused}
        >
          <SelectTrigger id="sync-frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESET_FREQUENCIES.map(preset => (
              <SelectItem key={preset.value} value={preset.value}>
                <div>
                  <div className="font-medium text-left">{preset.label}</div>
                  <div className="text-xs text-gray-500 text-left">{preset.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Custom Expression Input */}
      {isCustomMode && (
        <div className="space-y-2">
          <Label htmlFor="custom-cron">Custom Cron Expression</Label>
          <Input
            id="custom-cron"
            value={customExpression}
            onChange={(e) => handleCustomExpressionChange(e.target.value)}
            placeholder="0 * * * *"
            disabled={isPaused}
            className={cn(validationError && "border-red-500")}
          />
          {validationError ? (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {validationError}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Info className="h-4 w-4" />
              Format: minute hour day month weekday
            </div>
          )}
        </div>
      )}

      {/* Schedule Preview */}
      {!validationError && frequency !== 'manual' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-blue-900">Schedule Preview</p>
                {cronDescription && (
                  <p className="text-sm text-blue-700">{cronDescription}</p>
                )}
                <div className="mt-2">
                  <p className="text-xs font-medium text-blue-800">Next sync times:</p>
                  <div className="text-xs text-blue-700 space-y-0.5">
                    {getNextSyncTimes(frequency).map((time, index) => (
                      <div key={index}>• {time}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Status and Manual Sync */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            {isPaused ? (
              <span>Sync is paused</span>
            ) : lastSyncAt ? (
              <span>Last synced: {new Date(lastSyncAt).toLocaleString()}</span>
            ) : (
              <span>Never synced</span>
            )}
          </div>
          
          {onManualSync && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSync}
              disabled={syncing}
            >
              <Play className="h-4 w-4 mr-2" />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          )}
        </div>

        {/* Next Sync Time */}
        {!isPaused && frequency !== 'manual' && lastSyncAt && (
          <div className="text-sm text-gray-500">
            Next sync: {getNextSyncTime(frequency)}
          </div>
        )}
      </div>
    </div>
  )
}

function getNextSyncTimes(cronExpression: string, count: number = 3): string[] {
  try {
    const interval = parser.parse(cronExpression)
    const times: string[] = []
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    for (let i = 0; i < count; i++) {
      const nextDate = interval.next().toDate()
      const dateOnly = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate())
      
      let dateLabel: string
      if (dateOnly.getTime() === today.getTime()) {
        dateLabel = 'Today'
      } else if (dateOnly.getTime() === tomorrow.getTime()) {
        dateLabel = 'Tomorrow'
      } else {
        dateLabel = nextDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      }
      
      const timeStr = nextDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
      
      times.push(`${dateLabel} ${timeStr}`)
    }
    
    return times
  } catch {
    return []
  }
}

function getNextSyncTime(cronExpression: string): string {
  try {
    // Use cron-parser to calculate the next execution time
    const interval = parser.parse(cronExpression)
    const nextDate = interval.next().toDate()
    return nextDate.toLocaleString()
  } catch {
    return 'According to schedule'
  }
}