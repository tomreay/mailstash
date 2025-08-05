'use client'

import { useState } from 'react'
import { AlertCircle, Trash2, Clock, Calendar, Archive, TestTube } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface AutoDeleteSettingsProps {
  enabled: boolean
  deleteDelayHours: number | null
  deleteAgeMonths: number | null
  deleteOnlyArchived: boolean
  onEnabledChange: (enabled: boolean) => void
  onDelayChange: (hours: number | null) => void
  onAgeChange: (months: number | null) => void
  onArchivedOnlyChange: (archivedOnly: boolean) => void
  onTestRun?: () => Promise<{ count: number; emails: string[] }>
  className?: string
}

const DELAY_PRESETS = [
  { hours: 0, label: 'Immediately' },
  { hours: 1, label: '1 hour' },
  { hours: 24, label: '1 day' },
  { hours: 168, label: '1 week' },
]

const AGE_PRESETS = [
  { months: 1, label: '1 month' },
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 18, label: '18 months' },
]

export function AutoDeleteSettings({
  enabled,
  deleteDelayHours,
  deleteAgeMonths,
  deleteOnlyArchived,
  onEnabledChange,
  onDelayChange,
  onAgeChange,
  onArchivedOnlyChange,
  onTestRun,
  className
}: AutoDeleteSettingsProps) {
  const [testRunning, setTestRunning] = useState(false)
  const [testResults, setTestResults] = useState<{ count: number; emails: string[] } | null>(null)

  const handleTestRun = async () => {
    if (!onTestRun) return

    try {
      setTestRunning(true)
      setTestResults(null)
      const results = await onTestRun()
      setTestResults(results)
    } catch (error) {
      console.error('Test run failed:', error)
    } finally {
      setTestRunning(false)
    }
  }

  const getDeleteSummary = () => {
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
    
    if (conditions.length === 0) {
      return 'No deletion rules configured'
    }
    
    return `Delete emails: ${conditions.join(', ')}`
  }

  const hasValidRules = deleteDelayHours !== null || deleteAgeMonths !== null

  return (
    <div className={cn("space-y-6", className)}>
      {/* Warning Banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900">Important Warning</p>
            <p className="text-sm text-amber-700 mt-1">
              Auto-delete will permanently remove emails from your email provider.
              This action cannot be undone. Please configure carefully.
            </p>
          </div>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="auto-delete">Enable Auto-Delete</Label>
          <p className="text-sm text-gray-500">
            Automatically delete emails based on configured rules
          </p>
        </div>
        <Switch
          id="auto-delete"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={!hasValidRules}
        />
      </div>

      {/* Delete Rules Configuration */}
      <div className="space-y-4">
        <Label>Deletion Rules</Label>
        
        {/* Delete Delay */}
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
                disabled={enabled}
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
              disabled={enabled}
              className="w-36"
            />
            <span className="text-sm text-gray-500">hours after import</span>
            {deleteDelayHours !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelayChange(null)}
                disabled={enabled}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Delete Age */}
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
                disabled={enabled}
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
              disabled={enabled}
              className="w-36"
            />
            <span className="text-sm text-gray-500">months old</span>
            {deleteAgeMonths !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAgeChange(null)}
                disabled={enabled}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Additional Options */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="archived-only"
              checked={deleteOnlyArchived}
              onCheckedChange={(checked) => onArchivedOnlyChange(checked as boolean)}
              disabled={enabled}
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

      {/* Rule Summary */}
      {hasValidRules && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Trash2 className="h-4 w-4 text-gray-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Current Rule</p>
              <p className="text-sm text-gray-600">{getDeleteSummary()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Test Run Section */}
      {hasValidRules && onTestRun && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Label>Test Your Rules</Label>
              <p className="text-sm text-gray-500">
                Preview which emails would be deleted with current settings
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestRun}
              disabled={testRunning || enabled}
            >
              <TestTube className="h-4 w-4 mr-2" />
              {testRunning ? 'Testing...' : 'Run Test'}
            </Button>
          </div>

          {testResults && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900">
                Test Results: {testResults.count} emails would be deleted
              </p>
              {testResults.count > 0 && testResults.emails.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-blue-700 mb-1">Sample emails:</p>
                  <ul className="text-xs text-blue-600 space-y-0.5">
                    {testResults.emails.slice(0, 5).map((email, index) => (
                      <li key={index} className="truncate">• {email}</li>
                    ))}
                    {testResults.count > 5 && (
                      <li className="text-blue-500">...and {testResults.count - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Enable Warning */}
      {!hasValidRules && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600">
            Please configure at least one deletion rule before enabling auto-delete.
          </p>
        </div>
      )}
    </div>
  )
}