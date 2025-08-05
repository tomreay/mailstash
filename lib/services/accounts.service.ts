import { AccountsDAO, CreateAccountData, AccountWithStats, AccountDetails } from '@/lib/dao/accounts.dao'
import { EmailAccountSettings, UpdateEmailAccountSettings } from '@/lib/types/account-settings'

export interface CreateAccountRequest {
  provider: string
  email: string
  displayName?: string
  imapConfig?: {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
  }
}

export interface AccountCreationResult {
  id: string
  email: string
  displayName: string | null
  provider: string
  isActive: boolean
  createdAt: string
}

/**
 * Service layer for account business logic
 */
export class AccountsService {
  /**
   * Get all accounts for a user with stats
   */
  static async getUserAccountsWithStats(userId: string): Promise<AccountWithStats[]> {
    return await AccountsDAO.findAccountsWithStats(userId)
  }

  /**
   * Create a new email account
   */
  static async createAccount(userId: string, request: CreateAccountRequest): Promise<AccountCreationResult> {
    const { provider, email, displayName, imapConfig } = request

    // Validate required fields
    if (!provider || !email) {
      throw new Error('Provider and email are required')
    }

    // Check if account already exists
    const existingAccount = await AccountsDAO.findByEmail(email)
    if (existingAccount) {
      throw new Error('Account with this email already exists')
    }

    // Prepare account data
    let accountData: CreateAccountData = {
      email,
      displayName: displayName || email,
      provider,
      userId,
      isActive: true,
    }

    // Add IMAP configuration if provided
    if (provider === 'imap' && imapConfig) {
      accountData = {
        ...accountData,
        imapHost: imapConfig.host,
        imapPort: imapConfig.port,
        imapSecure: imapConfig.secure,
        imapUser: imapConfig.user,
        imapPass: imapConfig.pass,
      }
    }

    // Create account
    const account = await AccountsDAO.createAccount(accountData)

    // Create default settings and sync status
    await Promise.all([
      AccountsDAO.createDefaultSettings(account.id),
      AccountsDAO.createSyncStatus(account.id)
    ])

    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      provider: account.provider,
      isActive: account.isActive,
      createdAt: account.createdAt.toISOString(),
    }
  }

  /**
   * Get account details by ID
   */
  static async getAccountDetails(accountId: string, userId: string): Promise<AccountDetails> {
    const account = await AccountsDAO.findAccountDetails(accountId, userId)
    
    if (!account) {
      throw new Error('Account not found')
    }

    return account
  }

  /**
   * Validate user has access to account
   */
  static async validateUserAccess(accountId: string, userId: string): Promise<void> {
    const account = await AccountsDAO.findByIdAndUserId(accountId, userId)
    
    if (!account) {
      throw new Error('Account not found or access denied')
    }
  }

  /**
   * Update account settings
   */
  static async updateAccountSettings(
    accountId: string, 
    userId: string, 
    settings: UpdateEmailAccountSettings
  ): Promise<EmailAccountSettings> {
    // Verify account belongs to user
    await this.validateUserAccess(accountId, userId)

    // Settings object is already properly typed as UpdateEmailAccountSettings
    // The DAO's upsert method will handle undefined fields appropriately
    return await AccountsDAO.upsertAccountSettings(accountId, settings)
  }


  /**
   * Delete account
   */
  static async deleteAccount(accountId: string): Promise<void> {
    await AccountsDAO.deleteAccount(accountId)
  }
}