import { db } from '@/lib/db';

export interface StatsData {
  totalEmails: number;
  unreadEmails: number;
  totalAttachments: number;
  storageUsed: number;
  lastSyncAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
}

/**
 * Data Access Object for statistics-related database operations
 */
export class StatsDAO {
  /**
   * Get comprehensive stats for a single account
   */
  static async getAccountStats(accountId: string): Promise<{
    emailCount: number;
    storageStats: { _sum: { size: number | null } };
    unreadCount: number;
    attachmentCount: number;
  }> {
    const [storageStats, unreadCount, attachmentCount, emailCount] =
      await Promise.all([
        db.email.aggregate({
          where: { accountId },
          _sum: { size: true },
        }),
        db.email.count({
          where: { accountId, isRead: false },
        }),
        db.attachment.count({
          where: { email: { accountId } },
        }),
        db.email.count({
          where: { accountId },
        }),
      ]);

    return {
      emailCount,
      storageStats,
      unreadCount,
      attachmentCount,
    };
  }

  /**
   * Get aggregated stats for multiple accounts
   */
  static async getAggregatedStats(accountIds: string[]): Promise<{
    storageStats: { _sum: { size: number | null } };
    unreadCount: number;
    attachmentCount: number;
    totalEmails: number;
  }> {
    const [storageStats, unreadCount, attachmentCount, totalEmails] =
      await Promise.all([
        db.email.aggregate({
          where: { accountId: { in: accountIds } },
          _sum: { size: true },
        }),
        db.email.count({
          where: { accountId: { in: accountIds }, isRead: false },
        }),
        db.attachment.count({
          where: { email: { accountId: { in: accountIds } } },
        }),
        db.email.count({
          where: { accountId: { in: accountIds } },
        }),
      ]);

    return {
      storageStats,
      unreadCount,
      attachmentCount,
      totalEmails,
    };
  }

  /**
   * Find the most recent sync from a list of accounts
   */
  static findMostRecentSync(
    accounts: Array<{
      jobStatuses: Array<{
        lastRunAt?: Date | null;
      }>;
    }>
  ): Date | null {
    const allSyncDates = accounts
      .flatMap(a => a.jobStatuses || [])
      .map(js => js.lastRunAt)
      .filter(Boolean) as Date[];

    if (allSyncDates.length === 0) return null;

    return allSyncDates.sort((a, b) => b.getTime() - a.getTime())[0];
  }

  /**
   * Determine overall sync status from multiple accounts
   */
  static async determineOverallSyncStatus(
    accounts: Array<{ id: string }>
  ): Promise<'idle' | 'syncing' | 'error'> {
    const { JobStatusService } = await import('@/lib/services/job-status.service');

    for (const account of accounts) {
      const status = await JobStatusService.getCurrentStatus(account.id, 'sync');
      if (status.status === 'running') return 'syncing';
      if (status.status === 'error') return 'error';
    }

    return 'idle';
  }

  /**
   * Create empty stats response
   */
  static createEmptyStats(): StatsData {
    return {
      totalEmails: 0,
      unreadEmails: 0,
      totalAttachments: 0,
      storageUsed: 0,
      lastSyncAt: null,
      syncStatus: 'idle',
    };
  }

  /**
   * Format stats response for single account
   */
  static async formatSingleAccountStats(
    account: {
      id: string;
      _count: { emails: number };
      jobStatuses: Array<{
        lastRunAt?: Date | null;
        success?: boolean;
      }>;
    },
    stats: {
      storageStats: { _sum: { size: number | null } };
      unreadCount: number;
      attachmentCount: number;
    }
  ): Promise<StatsData> {
    const { JobStatusService } = await import('@/lib/services/job-status.service');
    const status = await JobStatusService.getCurrentStatus(account.id, 'sync');

    return {
      totalEmails: account._count.emails,
      unreadEmails: stats.unreadCount,
      totalAttachments: stats.attachmentCount,
      storageUsed: stats.storageStats._sum.size || 0,
      lastSyncAt: status.lastRunAt?.toISOString() || null,
      syncStatus: status.status === 'running' ? 'syncing' :
                  status.status === 'error' ? 'error' : 'idle',
    };
  }

  /**
   * Format stats response for multiple accounts
   */
  static formatAggregatedStats(
    stats: {
      storageStats: { _sum: { size: number | null } };
      unreadCount: number;
      attachmentCount: number;
      totalEmails: number;
    },
    mostRecentSync: Date | null,
    overallSyncStatus: 'idle' | 'syncing' | 'error'
  ): StatsData {
    return {
      totalEmails: stats.totalEmails,
      unreadEmails: stats.unreadCount,
      totalAttachments: stats.attachmentCount,
      storageUsed: stats.storageStats._sum.size || 0,
      lastSyncAt: mostRecentSync?.toISOString() || null,
      syncStatus: overallSyncStatus,
    };
  }
}
