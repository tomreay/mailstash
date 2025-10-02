export const JOB_CONFIG = {
  gmail: {
    batchSize: 500,
    minSyncDelay: 5 * 60 * 1000, // 5 minutes
    defaultSyncDelay: 15 * 60 * 1000, // 15 minutes
    maxSyncDelay: 30 * 60 * 1000, // 30 minutes
  },
  imap: {
    batchSize: 100,
    defaultSyncDays: 30,
    incrementalSyncDays: 7,
    minSyncDelay: 5 * 60 * 1000,
    defaultSyncDelay: 15 * 60 * 1000,
    maxSyncDelay: 30 * 60 * 1000,
  },
  priorities: {
    fullSync: 10,
    incrementalSync: 0,
    folderSync: 0,
    autoDelete: -1,
    mboxImport: 5,
  },
  retry: {
    maxAttempts: 3,
    backoffMultiplier: 2,
    initialDelay: 1000,
  },
  autoDelete: {
    batchSize: 1000,
    minDelay: 60 * 1000, // 1 minute after sync
  },
  thresholds: {
    activeSync: 10, // More than 10 emails = active sync pattern
    checkpointInterval: 500, // Save checkpoint every 500 messages
  },
} as const;

// Helper functions for job scheduling
export function getNextSyncDelay(emailsProcessed: number, provider: 'gmail' | 'imap' = 'gmail'): number {
  const config = JOB_CONFIG[provider];

  if (emailsProcessed > JOB_CONFIG.thresholds.activeSync) {
    return config.minSyncDelay;
  } else if (emailsProcessed > 0) {
    return config.defaultSyncDelay;
  } else {
    return config.maxSyncDelay;
  }
}

export function generateJobKey(taskType: string, accountId: string, suffix?: string): string {
  const parts = [`email:${taskType}`, accountId];
  if (suffix) {
    parts.push(suffix);
  }
  return parts.join(':');
}