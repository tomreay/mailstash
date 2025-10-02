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

// Type for the PgClient from graphile-worker
interface PgClient {
  query: (sql: string, values: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
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
        metadata: lastStatus?.metadata as JobMetadata | undefined,
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
   * Check if there's a queued job (exists but not yet running)
   */
  static async getQueuedJob(accountId: string, jobType: string): Promise<boolean> {
    const utils = await getWorkerUtils();
    const jobKeys = this.getJobKeys(accountId, jobType);

    return utils.withPgClient(async (client: PgClient) => {
      const { rows } = await client.query(
        `
        SELECT 1
        FROM graphile_worker.jobs j
        WHERE j.key = ANY($1::text[])
          AND j.locked_at IS NULL
        LIMIT 1
      `,
        [jobKeys]
      );

      return rows.length > 0;
    });
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

    console.log('[getActiveGraphileJob] Looking for jobs with keys:', jobKeys);

    // Type for the job row from graphile-worker
    interface GraphileJob {
      attempts: number;
      max_attempts: number;
      key: string;
      locked_at: Date | null;
      [key: string]: unknown;
    }

    const job = await utils.withPgClient(async (client: PgClient) => {
      // First check all jobs with these keys (including queued ones)
      const { rows: allJobs } = await client.query(
        `
        SELECT j.key, j.locked_at, j.run_at, j.attempts
        FROM graphile_worker.jobs j
        WHERE j.key = ANY($1::text[])
        ORDER BY j.created_at DESC
      `,
        [jobKeys]
      );

      console.log('[getActiveGraphileJob] All jobs found:', allJobs);

      // Now check for actively running job (locked_at NOT NULL)
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

      if (rows[0]) {
        console.log('[getActiveGraphileJob] Active job found:', {
          key: (rows[0] as GraphileJob).key,
          locked_at: (rows[0] as GraphileJob).locked_at,
          attempts: (rows[0] as GraphileJob).attempts
        });
      } else {
        console.log('[getActiveGraphileJob] No active job found (no locked_at)');
      }

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
      incremental_sync: ['email:incremental_sync'],
      full_sync: ['email:full_sync'],
      folder_sync: ['email:folder_sync'],
      sync: ['email:incremental_sync', 'email:full_sync', 'email:folder_sync'], // Legacy support
      auto_delete: ['email:auto_delete', 'email:auto_delete_dry_run'],
      mbox_import: ['email:mbox_import'],
    };

    return mapping[jobType] || [`email:${jobType}`];
  }

  /**
   * Update job metadata without changing success/error status
   * Uses raw SQL to ensure atomic merge operation
   */
  static async updateMetadata(
    accountId: string,
    jobType: string,
    metadata: Partial<JobMetadata>
  ) {
    await db.$executeRaw`
      INSERT INTO "job_status" ("id", "accountId", "jobType", "lastRunAt", "success", "error", "metadata", "updatedAt")
      VALUES (gen_random_uuid(), ${accountId}, ${jobType}, ${new Date()}, false, null, ${metadata}::jsonb, ${new Date()})
      ON CONFLICT ("accountId", "jobType")
      DO UPDATE SET
        "metadata" = COALESCE("job_status"."metadata", '{}'::jsonb) || ${metadata}::jsonb,
        "updatedAt" = ${new Date()}
    `;
  }

  /**
   * Check if a full sync has been completed for an account
   */
  static async hasCompletedFullSync(accountId: string): Promise<boolean> {
    const fullSyncStatus = await db.jobStatus.findUnique({
      where: {
        accountId_jobType: {
          accountId,
          jobType: 'full_sync',
        },
      },
    });

    return fullSyncStatus?.success === true;
  }
}