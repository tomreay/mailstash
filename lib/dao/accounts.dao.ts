import { db } from '@/lib/db';
import {
  EmailAccountSettings,
  EmailAccountSettingsSummary,
  UpdateEmailAccountSettings,
  AutoDeleteMode,
} from '@/lib/types/account-settings';

export interface CreateAccountData {
  email: string;
  displayName: string | null;
  provider: string;
  userId: string;
  isActive: boolean;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapUser?: string;
  imapPass?: string;
}

export interface AccountWithStats {
  id: string;
  email: string;
  displayName: string | null;
  provider: string;
  isActive: boolean;
  emailCount: number;
  folderCount: number;
  storageUsed: number;
  lastSyncAt: string | null;
  syncStatus: string;
  settings: EmailAccountSettingsSummary | null;
  createdAt: string;
}

export interface AccountDetails {
  id: string;
  email: string;
  displayName: string | null;
  provider: string;
  isActive: boolean;
  emailCount: number;
  folderCount: number;
  filterRuleCount: number;
  storageUsed: number;
  lastSyncAt: string | null;
  syncStatus: string;
  settings: EmailAccountSettings | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Data Access Object for account-related database operations
 */
export class AccountsDAO {
  /**
   * Find all accounts for a user with basic stats
   */
  static async findAccountsWithStats(
    userId: string
  ): Promise<AccountWithStats[]> {
    // Get all user accounts with basic info and stats
    const accounts = await db.emailAccount.findMany({
      where: {
        userId,
      },
      include: {
        syncStatus: true,
        settings: true,
        _count: {
          select: {
            emails: true,
            folders: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Calculate storage used per account
    return await Promise.all(
      accounts.map(async account => {
        const storageStats = await db.email.aggregate({
          where: { accountId: account.id },
          _sum: { size: true },
        });

        return {
          id: account.id,
          email: account.email,
          displayName: account.displayName,
          provider: account.provider,
          isActive: account.isActive,
          emailCount: account._count.emails,
          folderCount: account._count.folders,
          storageUsed: storageStats._sum.size || 0,
          lastSyncAt: account.syncStatus?.lastSyncAt?.toISOString() || null,
          syncStatus: account.syncStatus?.syncStatus || 'idle',
          settings: account.settings
            ? {
                syncFrequency: account.settings.syncFrequency,
                syncPaused: account.settings.syncPaused,
                autoDeleteMode: account.settings
                  .autoDeleteMode as AutoDeleteMode,
              }
            : null,
          createdAt: account.createdAt.toISOString(),
        };
      })
    );
  }

  /**
   * Find account by email
   */
  static async findByEmail(email: string) {
    return await db.emailAccount.findUnique({
      where: { email },
    });
  }

  /**
   * Create a new email account
   */
  static async createAccount(accountData: CreateAccountData) {
    return await db.emailAccount.create({
      data: accountData,
      include: {
        syncStatus: true,
        settings: true,
      },
    });
  }

  /**
   * Create default settings for an account
   */
  static async createDefaultSettings(accountId: string) {
    return await db.emailAccountSettings.create({
      data: {
        accountId,
      },
    });
  }

  /**
   * Create sync status for an account
   */
  static async createSyncStatus(accountId: string) {
    return await db.syncStatus.create({
      data: {
        accountId,
        syncStatus: 'idle',
      },
    });
  }

  /**
   * Find account by ID and user ID with detailed stats
   */
  static async findAccountDetails(
    accountId: string,
    userId: string
  ): Promise<AccountDetails | null> {
    const account = await db.emailAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
      include: {
        syncStatus: true,
        settings: true,
        _count: {
          select: {
            emails: true,
            folders: true,
            filterRules: true,
          },
        },
      },
    });

    if (!account) {
      return null;
    }

    // Get storage stats
    const storageStats = await db.email.aggregate({
      where: { accountId: account.id },
      _sum: { size: true },
    });

    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      provider: account.provider,
      isActive: account.isActive,
      emailCount: account._count.emails,
      folderCount: account._count.folders,
      filterRuleCount: account._count.filterRules,
      storageUsed: storageStats._sum.size || 0,
      lastSyncAt: account.syncStatus?.lastSyncAt?.toISOString() || null,
      syncStatus: account.syncStatus?.syncStatus || 'idle',
      settings: account.settings as EmailAccountSettings | null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  /**
   * Find account by ID and user ID (basic info only)
   */
  static async findByIdAndUserId(accountId: string, userId: string) {
    return await db.emailAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });
  }

  /**
   * Delete account by ID
   */
  static async deleteAccount(accountId: string) {
    return await db.emailAccount.delete({
      where: { id: accountId },
    });
  }

  /**
   * Find user's active accounts
   */
  static async findActiveAccounts(userId: string, accountId?: string) {
    return await db.emailAccount.findMany({
      where: {
        userId,
        isActive: true,
        ...(accountId ? { id: accountId } : {}),
      },
      select: { id: true },
    });
  }

  /**
   * Find user's accounts with sync status for stats aggregation
   */
  static async findAccountsWithSyncStatus(userId: string, accountId?: string) {
    return await db.emailAccount.findMany({
      where: {
        userId,
        isActive: true,
        ...(accountId ? { id: accountId } : {}),
      },
      include: {
        syncStatus: true,
        _count: {
          select: {
            emails: true,
          },
        },
      },
    });
  }

  /**
   * Update or create account settings
   */
  static async upsertAccountSettings(
    accountId: string,
    settingsData: UpdateEmailAccountSettings
  ): Promise<EmailAccountSettings> {
    const result = await db.emailAccountSettings.upsert({
      where: {
        accountId,
      },
      update: settingsData,
      create: {
        accountId,
        ...settingsData,
      },
    });

    return result as EmailAccountSettings;
  }
}
