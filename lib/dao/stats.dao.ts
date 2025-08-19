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
      syncStatus?: {
        lastSyncAt?: Date | null;
      } | null;
    }>
  ): Date | null {
    const mostRecentSync = accounts
      .filter(a => a.syncStatus?.lastSyncAt)
      .sort((a, b) => {
        const dateA = a.syncStatus?.lastSyncAt?.getTime() || 0;
        const dateB = b.syncStatus?.lastSyncAt?.getTime() || 0;
        return dateB - dateA;
      })[0];

    return mostRecentSync?.syncStatus?.lastSyncAt || null;
  }

  /**
   * Determine overall sync status from multiple accounts
   */
  static determineOverallSyncStatus(
    accounts: Array<{
      syncStatus?: {
        syncStatus?: string | null;
      } | null;
    }>
  ): 'idle' | 'syncing' | 'error' {
    // Error if any account has error, syncing if any is syncing, else idle
    const hasError = accounts.some(a => a.syncStatus?.syncStatus === 'error');
    const isSyncing = accounts.some(
      a => a.syncStatus?.syncStatus === 'syncing'
    );

    if (hasError) return 'error';
    if (isSyncing) return 'syncing';
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
  static formatSingleAccountStats(
    account: {
      _count: { emails: number };
      syncStatus?: {
        lastSyncAt?: Date | null;
        syncStatus?: string | null;
      } | null;
    },
    stats: {
      storageStats: { _sum: { size: number | null } };
      unreadCount: number;
      attachmentCount: number;
    }
  ): StatsData {
    return {
      totalEmails: account._count.emails,
      unreadEmails: stats.unreadCount,
      totalAttachments: stats.attachmentCount,
      storageUsed: stats.storageStats._sum.size || 0,
      lastSyncAt: account.syncStatus?.lastSyncAt?.toISOString() || null,
      syncStatus:
        (account.syncStatus?.syncStatus as 'idle' | 'syncing' | 'error') ||
        'idle',
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
