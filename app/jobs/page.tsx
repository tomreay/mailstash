import { getActiveJobs, getPendingJobs, getFailedJobs } from '@/lib/jobs/queue';
import { RefreshButton } from '@/components/jobs/refresh-button';
import { JobsList } from '@/components/jobs/jobs-list';
import { AlertCircle, Clock } from 'lucide-react';

export default async function JobsPage() {
  // Fetch all jobs data on the server
  const [activeJobs, pendingJobs, failedJobs] = await Promise.all([
    getActiveJobs(),
    getPendingJobs(100),
    getFailedJobs(100),
  ]);

  return (
    <div className='container mx-auto py-8 px-4'>
      <div className='space-y-6'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold'>Job Monitor</h2>
          <RefreshButton />
        </div>

        {/* Active Jobs */}
        <div>
          <h3 className='text-lg font-semibold mb-3 flex items-center gap-2'>
            <Clock className='h-5 w-5' />
            Active Jobs ({activeJobs.length})
          </h3>
          <JobsList jobs={activeJobs} type='active' />
        </div>

        {/* Pending Jobs */}
        <div>
          <h3 className='text-lg font-semibold mb-3 flex items-center gap-2'>
            <Clock className='h-5 w-5 text-gray-500' />
            Pending Jobs ({pendingJobs.length})
          </h3>
          <JobsList jobs={pendingJobs} type='pending' maxDisplay={10} />
        </div>

        {/* Failed Jobs */}
        <div>
          <h3 className='text-lg font-semibold mb-3 flex items-center gap-2'>
            <AlertCircle className='h-5 w-5 text-red-500' />
            Failed Jobs ({failedJobs.length})
          </h3>
          <JobsList jobs={failedJobs} type='failed' maxDisplay={5} />
        </div>
      </div>
    </div>
  );
}
