import { StatsDAO } from '@/lib/dao/stats.dao';
import { AccountsDAO } from '@/lib/dao/accounts.dao';
import { StatsResponse } from '@/types';

/**
 * Service layer for statistics business logic
 */
export class StatsService {
  /**
   * Get statistics for user's accounts
   */
  static async getUserStats(
    userId: string,
    accountId?: string
  ): Promise<StatsResponse> {
    // Get user's email account(s)
    const accounts = await AccountsDAO.findAccountsWithSyncStatus(
      userId,
      accountId
    );

    if (accounts.length === 0) {
      return StatsDAO.createEmptyStats();
    }

    // If single account requested or only one account exists, return stats for that account
    if (accountId || accounts.length === 1) {
      return await this.getSingleAccountStats(accounts[0]);
    }

    // Aggregate stats for all accounts
    return await this.getAggregatedAccountsStats(accounts);
  }

  /**
   * Get stats for a single account
   */
  private static async getSingleAccountStats(account: {
    id: string;
    _count: { emails: number };
    syncStatus?: {
      lastSyncAt?: Date | null;
      syncStatus?: string | null;
    } | null;
  }): Promise<StatsResponse> {
    const stats = await StatsDAO.getAccountStats(account.id);

    return StatsDAO.formatSingleAccountStats(account, stats);
  }

  /**
   * Get aggregated stats for multiple accounts
   */
  private static async getAggregatedAccountsStats(
    accounts: Array<{
      id: string;
      syncStatus?: {
        lastSyncAt?: Date | null;
        syncStatus?: string | null;
      } | null;
    }>
  ): Promise<StatsResponse> {
    const accountIds = accounts.map(a => a.id);

    // Get aggregated stats
    const stats = await StatsDAO.getAggregatedStats(accountIds);

    // Find most recent sync
    const mostRecentSync = StatsDAO.findMostRecentSync(accounts);

    // Determine overall sync status
    const overallSyncStatus = StatsDAO.determineOverallSyncStatus(accounts);

    return StatsDAO.formatAggregatedStats(
      stats,
      mostRecentSync,
      overallSyncStatus
    );
  }
}
