import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { fetchDryRunStatus } from '@/lib/api/dry-run';
import { DryRunStatusData } from '@/types/dry-run';

/**
 * Hook to fetch and poll dry run status for an account
 * Automatically polls when status is running or pending
 */
export function useDryRunStatus(accountId: string) {
  const router = useRouter();

  const { data, error, isLoading, refetch } = useQuery<DryRunStatusData>({
    queryKey: ['dry-run-status', accountId],
    queryFn: () => fetchDryRunStatus(accountId),
    // Refetch every 2 seconds when status is running or pending
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'running' || data?.status === 'pending') {
        return 2000; // 2 seconds
      }
      return false; // Don't refetch when completed or failed
    },
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error.message === 'Unauthorized') {
        router.push('/auth/signin');
        return false;
      }
      return failureCount < 3;
    },
  });

  return {
    dryRunStatus: data,
    setDryRunStatus: refetch,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
}