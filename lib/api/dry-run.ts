import { DryRunStatusData } from '@/types/dry-run';

export async function fetchDryRunStatus(accountId: string): Promise<DryRunStatusData> {
  const res = await fetch(`/api/accounts/${accountId}/dry-run-status`);
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Unauthorized');
    }
    throw new Error('Failed to fetch dry-run status');
  }
  return res.json();
}