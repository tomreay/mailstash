'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Job {
  id: string;
  task_identifier: string;
  payload: Record<string, unknown>;
  run_at: string;
  attempts: number;
  max_attempts: number;
  created_at: string;
  locked_at?: string;
  locked_by?: string;
  last_error?: string;
}

interface JobsListProps {
  jobs: Job[];
  type: 'active' | 'pending' | 'failed';
  maxDisplay?: number;
}

export function JobsList({ jobs, type, maxDisplay }: JobsListProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleJobAction = async (jobId: string, action: 'retry' | 'cancel') => {
    setLoadingAction(jobId);
    setError(null);
    
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
      if (!response.ok) throw new Error(`Failed to ${action} job`);
      
      // Refresh the page to show updated data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingAction(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getJobTypeColor = (taskIdentifier: string) => {
    if (taskIdentifier.includes('full_sync')) return 'text-blue-600';
    if (taskIdentifier.includes('incremental_sync')) return 'text-green-600';
    if (taskIdentifier.includes('folder_sync')) return 'text-purple-600';
    if (taskIdentifier.includes('cleanup')) return 'text-gray-600';
    return 'text-gray-800';
  };

  if (jobs.length === 0) {
    return <p className="text-gray-500">No {type} jobs</p>;
  }

  const displayJobs = maxDisplay ? jobs.slice(0, maxDisplay) : jobs;

  return (
    <>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 mb-4">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      )}
      
      <div className="space-y-2">
        {displayJobs.map((job) => (
          <div 
            key={job.id} 
            className={`border rounded-lg p-4 ${
              type === 'active' ? 'bg-blue-50' : 
              type === 'failed' ? 'border-red-200 bg-red-50' : ''
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className={`font-medium ${getJobTypeColor(job.task_identifier)}`}>
                  {job.task_identifier}
                </p>
                <p className="text-sm text-gray-600">
                  {type === 'active' && job.locked_at
                    ? `Started: ${formatDate(job.locked_at)}`
                    : type === 'pending'
                    ? `Scheduled: ${formatDate(job.run_at)}`
                    : `Failed: ${formatDate(job.run_at)}`}
                </p>
                {job.payload?.accountId ? (
                  <p className="text-sm text-gray-600">
                    Account: {job.payload.accountId as string}
                  </p>
                ) : null}
                {type === 'failed' && job.last_error && (
                  <p className="text-sm text-red-600 mt-1">
                    Error: {job.last_error}
                  </p>
                )}
                {type === 'active' && (
                  <p className="text-sm text-gray-500">
                    Attempt {job.attempts}/{job.max_attempts}
                  </p>
                )}
              </div>
              {type === 'pending' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleJobAction(job.id, 'cancel')}
                  disabled={loadingAction === job.id}
                >
                  {loadingAction === job.id ? 'Cancelling...' : 'Cancel'}
                </Button>
              )}
              {type === 'failed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleJobAction(job.id, 'retry')}
                  disabled={loadingAction === job.id}
                >
                  {loadingAction === job.id ? 'Retrying...' : 'Retry'}
                </Button>
              )}
            </div>
          </div>
        ))}
        {maxDisplay && jobs.length > maxDisplay && (
          <p className="text-sm text-gray-500 text-center">
            And {jobs.length - maxDisplay} more...
          </p>
        )}
      </div>
    </>
  );
}