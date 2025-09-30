export type DryRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DryRunStatusData {
  status: DryRunStatus | null;
  startedAt: string | null;
  completedAt: string | null;
  totalEmails: number;
  processedEmails: number;
  markedCount: number;
  error: string | null;
}