import { JobHelpers } from 'graphile-worker';
import { db } from '@/lib/db';
import { JOB_CONFIG, generateJobKey, getNextSyncDelay } from '../config';
import parser from 'cron-parser';

export type ScheduleOptions = {
  delay?: number;
  runAt?: Date;
  priority?: number;
  jobKey?: string;
};

export async function scheduleIncrementalSync(
  accountId: string,
  helpers: JobHelpers,
  options: ScheduleOptions & { historyId?: string; lastSyncAt?: string } = {}
) {
  const accountSettings = await db.emailAccountSettings.findUnique({
    where: { accountId },
  });

  // Don't schedule if sync is paused or manual
  if (accountSettings?.syncPaused || accountSettings?.syncFrequency === 'manual') {
    console.log(
      `[scheduler] Not scheduling incremental sync - ${
        accountSettings.syncPaused ? 'paused' : 'manual'
      } for account ${accountId}`
    );
    return null;
  }

  const delay = options.delay || calculateSyncDelay(accountSettings?.syncFrequency);

  return helpers.addJob(
    'email:incremental_sync',
    {
      accountId,
      gmailHistoryId: options.historyId,
      lastSyncAt: options.lastSyncAt || new Date().toISOString(),
    },
    {
      runAt: options.runAt || new Date(Date.now() + delay),
      priority: options.priority ?? JOB_CONFIG.priorities.incrementalSync,
      jobKey: options.jobKey || generateJobKey('incremental_sync', accountId),
    }
  );
}

export async function scheduleFullSync(
  accountId: string,
  helpers: JobHelpers,
  options: ScheduleOptions = {}
) {
  return helpers.addJob(
    'email:full_sync',
    { accountId },
    {
      runAt: options.runAt || new Date(),
      priority: options.priority ?? JOB_CONFIG.priorities.fullSync,
      jobKey: options.jobKey || generateJobKey('full_sync', accountId),
    }
  );
}

export async function scheduleAutoDelete(
  accountId: string,
  helpers: JobHelpers,
  options: ScheduleOptions = {}
) {
  const accountSettings = await db.emailAccountSettings.findUnique({
    where: { accountId },
    select: { autoDeleteMode: true },
  });

  if (!accountSettings?.autoDeleteMode || accountSettings.autoDeleteMode === 'off') {
    return null;
  }

  return helpers.addJob(
    'email:auto_delete',
    { accountId },
    {
      runAt: options.runAt || new Date(Date.now() + JOB_CONFIG.autoDelete.minDelay),
      priority: options.priority ?? JOB_CONFIG.priorities.autoDelete,
      jobKey: options.jobKey || generateJobKey('auto_delete', accountId),
    }
  );
}

function calculateSyncDelay(syncFrequency?: string | null): number {
  if (!syncFrequency) {
    return JOB_CONFIG.gmail.defaultSyncDelay;
  }

  try {
    const interval = parser.parse(syncFrequency);
    const nextDate = interval.next().toDate();
    const delay = nextDate.getTime() - Date.now();

    // Ensure minimum delay
    const MIN_DELAY = 60 * 1000; // 1 minute
    return Math.max(delay, MIN_DELAY);
  } catch (error) {
    console.error(
      `[scheduler] Error parsing cron expression '${syncFrequency}', using default delay`,
      error
    );
    return JOB_CONFIG.gmail.defaultSyncDelay;
  }
}

export function shouldScheduleNextSync(
  emailsProcessed: number,
  provider: 'gmail' | 'imap' = 'gmail'
): { schedule: boolean; delay: number } {
  const delay = getNextSyncDelay(emailsProcessed, provider);

  // Always schedule if emails were processed
  if (emailsProcessed > 0) {
    return { schedule: true, delay };
  }

  // For quiet accounts, use longer delay
  return { schedule: true, delay: JOB_CONFIG[provider].maxSyncDelay };
}