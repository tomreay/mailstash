import { Task, JobHelpers } from 'graphile-worker';
import { EmailAccount } from '@/types/email';
import {JobMetadata, JobStatusService} from '@/lib/services/job-status.service';
import { db } from '@/lib/db';
import { isTransientError } from './utils/error-utils';

export type JobContext<T> = {
  payload: T;
  accountId: string;
  account: EmailAccount;
  helpers: JobHelpers;
};

export type JobHandler<T> = (ctx: JobContext<T>) => Promise<JobMetadata>;

export type JobOptions = {
  skipInactiveAccount?: boolean;
  recordStatus?: boolean;
};

const DEFAULT_OPTIONS: JobOptions = {
  skipInactiveAccount: true,
  recordStatus: true,
};

async function validateAccount(accountId: string): Promise<EmailAccount | null> {
  const account = await db.emailAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  return account as EmailAccount;
}

async function handleJobError(
  error: unknown,
  accountId: string,
  jobType: string,
  helpers: JobHelpers
): Promise<void> {
  console.error(
    `[${jobType}] Job failed for account ${accountId}`,
    error
  );

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const isFinalAttempt = helpers.job.attempts >= helpers.job.max_attempts;

  await JobStatusService.recordFailure(accountId, jobType, errorMessage, {
    attempt: helpers.job.attempts,
    maxAttempts: helpers.job.max_attempts,
    isFinal: isFinalAttempt,
  });

  // Re-throw for transient errors to let graphile-worker retry
  if (error instanceof Error && isTransientError(error)) {
    throw error;
  }

  // Don't throw for permanent errors to prevent unnecessary retries
  if (!isFinalAttempt) {
    console.error(`[${jobType}] Permanent error, not retrying`, error);
  }
}

export function createJobHandler<TPayload extends { accountId: string }>(
  jobType: string,
  handler: JobHandler<TPayload>,
  options: JobOptions = {}
): Task {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (payload, helpers) => {
    const { accountId } = payload as TPayload;

    try {
      // Record job start if enabled
      if (opts.recordStatus) {
        await JobStatusService.recordStart(accountId, jobType);
      }

      // Validate account exists
      const account = await validateAccount(accountId);
      if (!account) {
        return;
      }

      // Check if account is active
      if (opts.skipInactiveAccount && !account.isActive) {
        console.log(
          `[${jobType}] Account ${accountId} is not active, skipping`
        );

        if (opts.recordStatus) {
          await JobStatusService.recordSuccess(accountId, jobType, {
            skipped: true,
            reason: 'Account inactive',
          });
        }
        return;
      }

      // Execute the handler
      const result = await handler({
        payload: payload as TPayload,
        accountId,
        account: account as EmailAccount,
        helpers,
      });

      // Record success if enabled
      if (opts.recordStatus) {
        await JobStatusService.recordSuccess(accountId, jobType, result);
      }

      // Log completion
      console.log(
        `[${jobType}] Job completed for account ${accountId}`,
        result
      );

      return;
    } catch (error) {
      if (opts.recordStatus) {
        await handleJobError(error, accountId, jobType, helpers);
      } else {
        // Re-throw if not recording status
        throw error;
      }
    }
  };
}