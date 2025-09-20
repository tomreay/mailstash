import { db } from '@/lib/db';
import { getWorkerUtils } from '@/lib/jobs/queue';

// Type-safe metadata for different job types
export type SyncCheckpoint = {
  pageToken?: string;
  processedCount: number;
  lastProcessedMessageId?: string;
  startedAt: Date;
};

export type SyncJobMetadata = {
  emailsProcessed?: number;
  provider?: string;
  fullSync?: boolean;
  skipped?: boolean;
  reason?: string;
  attempt?: number;
  maxAttempts?: number;
  isFinal?: boolean;
  checkpoint?: SyncCheckpoint | null;
  lastCheckpointAt?: Date;
  error?: string;
  completedAt?: Date;
  totalProcessed?: number;
  failedMessageIds?: string[];
  failedCount?: number;
  retryStats?: {
    totalRetries: number;
    quotaErrors: number;
    rateLimitErrors: number;
  };
  lastIncrementalSync?: Date;
};

export type AutoDeleteJobMetadata = {
  mode?: string;
  count?: number;
  skipped?: boolean;
  reason?: string;
  attempt?: number;
  maxAttempts?: number;
  isFinal?: boolean;
};

export type MboxImportJobMetadata = {
  processed?: number;
  failed?: number;
  mboxFilePath?: string;
  fileSize?: number;
  skipped?: boolean;
  reason?: string;
  attempt?: number;
  maxAttempts?: number;
  isFinal?: boolean;
};

export type JobMetadata = SyncJobMetadata | AutoDeleteJobMetadata | MboxImportJobMetadata;

export interface CurrentStatus<T extends JobMetadata = JobMetadata> {
  status: 'running' | 'idle' | 'error' | 'never_run';
  lastRunAt?: Date | null;
  error?: string | null;
  metadata?: T;
  // For running jobs from graphile
  attempt?: number;
  maxAttempts?: number;
}

export class JobStatusService {
  /**
   * Record the start of a job execution
   */
  static async recordStart(accountId: string, jobType: string) {
    await db.jobStatus.upsert({
      where: {
        accountId_jobType: { accountId, jobType },
      },
      create: {
        accountId,
        jobType,
        lastRunAt: new Date(),
        success: false,
        error: null,
        metadata: {},
      },
      update: {
        lastRunAt: new Date(),
        success: false,
        error: null,
      },
    });
  }

  /**
   * Record successful job completion
   */
  static async recordSuccess(
    accountId: string,
    jobType: string,
    metadata?: JobMetadata
  ) {
    await db.jobStatus.upsert({
      where: {
        accountId_jobType: { accountId, jobType },
      },
      create: {
        accountId,
        jobType,
        lastRunAt: new Date(),
        success: true,
        error: null,
        metadata,
      },
      update: {
        lastRunAt: new Date(),
        success: true,
        error: null,
        metadata,
      },
    });
  }

  /**
   * Record job failure
   */
  static async recordFailure(
    accountId: string,
    jobType: string,
    error: string,
    metadata?: JobMetadata
  ) {
    await db.jobStatus.upsert({
      where: {
        accountId_jobType: { accountId, jobType },
      },
      create: {
        accountId,
        jobType,
        lastRunAt: new Date(),
        success: false,
        error,
        metadata,
      },
      update: {
        lastRunAt: new Date(),
        success: false,
        error,
        metadata,
      },
    });
  }

  /**
   * Get current job status by combining JobStatus table with active graphile jobs
   */
  static async getCurrentStatus(
    accountId: string,
    jobType: string
  ): Promise<CurrentStatus> {
    // Check for active job in graphile
    const activeJob = await this.getActiveGraphileJob(accountId, jobType);

    // Get last status from our table
    const lastStatus = await db.jobStatus.findUnique({
      where: {
        accountId_jobType: { accountId, jobType },
      },
    });

    // If job is currently running
    if (activeJob) {
      return {
        status: 'running',
        lastRunAt: lastStatus?.lastRunAt,
        attempt: activeJob.attempts,
        maxAttempts: activeJob.max_attempts,
      };
    }

    // If no record exists
    if (!lastStatus) {
      return { status: 'never_run' };
    }

    // Return last execution status
    return {
      status: lastStatus.success ? 'idle' : 'error',
      lastRunAt: lastStatus.lastRunAt,
      error: lastStatus.error,
      metadata: lastStatus.metadata as JobMetadata | undefined,
    };
  }

  /**
   * Check if a job is currently running for an account
   */
  static async isJobRunning(
    accountId: string,
    jobType: string
  ): Promise<boolean> {
    const activeJob = await this.getActiveGraphileJob(accountId, jobType);
    return !!activeJob;
  }

  /**
   * Get active job from graphile-worker using job keys
   */
  private static async getActiveGraphileJob(accountId: string, jobType: string): Promise<{
    attempts: number;
    max_attempts: number;
  } | null> {
    const utils = await getWorkerUtils();

    // Generate job keys for this account and job type
    const jobKeys = this.getJobKeys(accountId, jobType);

    // Type for the PgClient from graphile-worker
    interface PgClient {
      query: (sql: string, values: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
    }

    // Type for the job row from graphile-worker
    interface GraphileJob {
      attempts: number;
      max_attempts: number;
      key: string;
      [key: string]: unknown;
    }

    const job = await utils.withPgClient(async (client: PgClient) => {
      const { rows } = await client.query(
        `
        SELECT j.*
        FROM graphile_worker.jobs j
        WHERE j.key = ANY($1::text[])
          AND j.locked_at IS NOT NULL
        ORDER BY j.created_at DESC
        LIMIT 1
      `,
        [jobKeys]
      );

      return rows[0] as GraphileJob | undefined;
    });

    return job || null;
  }

  /**
   * Generate job keys for the account and job type
   * Job keys prevent duplicate jobs from being scheduled
   */
  private static getJobKeys(accountId: string, jobType: string): string[] {
    // Different job types can have different task identifiers
    // but they all use the same key format: {taskIdentifier}:{accountId}
    const taskIdentifiers = this.getTaskIdentifiers(jobType);
    return taskIdentifiers.map(taskId => `${taskId}:${accountId}`);
  }

  /**
   * Map our job types to graphile task identifiers
   */
  private static getTaskIdentifiers(jobType: string): string[] {
    const mapping: Record<string, string[]> = {
      sync: ['email:incremental_sync', 'email:full_sync', 'email:folder_sync'],
      auto_delete: ['email:auto_delete', 'email:auto_delete_dry_run'],
      mbox_import: ['email:mbox_import'],
    };

    return mapping[jobType] || [`email:${jobType}`];
  }

  /**
   * Update job metadata without changing success/error status
   */
  static async updateMetadata(
    accountId: string,
    jobType: string,
    metadata: Partial<JobMetadata>
  ) {
    const existing = await db.jobStatus.findUnique({
      where: {
        accountId_jobType: { accountId, jobType },
      },
    });

    await db.jobStatus.upsert({
      where: {
        accountId_jobType: { accountId, jobType },
      },
      create: {
        accountId,
        jobType,
        lastRunAt: new Date(),
        success: false,
        error: null,
        metadata,
      },
      update: {
        metadata: {
          ...(existing?.metadata as object || {}),
          ...metadata,
        },
      },
    });
  }

  /**
   * Get all job statuses for an account
   */
  static async getAccountJobStatuses(accountId: string) {
    const statuses = await db.jobStatus.findMany({
      where: { accountId },
      orderBy: { jobType: 'asc' },
    });

    // Check for active jobs
    const syncRunning = await this.isJobRunning(accountId, 'sync');
    const autoDeleteRunning = await this.isJobRunning(accountId, 'auto_delete');

    return statuses.map(status => ({
      ...status,
      isRunning:
        (status.jobType === 'sync' && syncRunning) ||
        (status.jobType === 'auto_delete' && autoDeleteRunning),
    }));
  }
}