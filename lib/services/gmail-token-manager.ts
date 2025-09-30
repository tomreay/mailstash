import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { EmailAccount } from '@/types/email';

/**
 * Centralized Gmail token management service
 * Handles automatic token refresh and storage
 */
export class GmailTokenManager {
  private readonly oauth2Client: OAuth2Client;
  private readonly accountId: string;
  private refreshPromise: Promise<void> | null = null;

  constructor(account: EmailAccount) {
    this.accountId = account.id;

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );

    this.oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.expiresAt?.getTime(),
    });

    // Enable automatic token refresh
    this.oauth2Client.on('tokens', async (tokens) => {
      console.log(`[GmailTokenManager] Tokens auto-refreshed for account ${this.accountId}`);
      await this.updateStoredTokens(tokens);
    });
  }

  /**
   * Get the OAuth2Client with valid tokens
   * Automatically refreshes if expired or expiring soon
   */
  async getValidClient(): Promise<OAuth2Client> {
    await this.ensureValidToken();
    return this.oauth2Client;
  }

  /**
   * Ensures the access token is valid and not expiring soon
   * Refreshes if needed (within 5 minutes of expiration)
   */
  private async ensureValidToken(): Promise<void> {
    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    const credentials = this.oauth2Client.credentials;

    // Check if token exists and is not expired or expiring soon
    if (credentials.expiry_date) {
      const now = Date.now();
      const expiryTime = credentials.expiry_date;
      const fiveMinutesInMs = 5 * 60 * 1000;

      // Token is still valid and not expiring soon
      if (expiryTime > now + fiveMinutesInMs) {
        return;
      }

      console.log(`[GmailTokenManager] Token expiring soon for account ${this.accountId}, refreshing...`);
    } else {
      console.log(`[GmailTokenManager] No expiry date found for account ${this.accountId}, attempting refresh...`);
    }

    // Refresh the token
    await this.refreshToken();
  }

  /**
   * Refresh the access token using the refresh token
   * Handles concurrent refresh requests
   */
  private async refreshToken(): Promise<void> {
    // Prevent concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Performs the actual token refresh
   */
  private async performRefresh(): Promise<void> {
    try {
      console.log(`[GmailTokenManager] Refreshing token for account ${this.accountId}...`);

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      console.log(`[GmailTokenManager] Token refreshed successfully for account ${this.accountId}`);

      // Update the OAuth2Client credentials
      this.oauth2Client.setCredentials(credentials);

      // Store the new tokens in the database
      await this.updateStoredTokens(credentials);
    } catch (error) {
      console.error(`[GmailTokenManager] Failed to refresh token for account ${this.accountId}:`, error);

      // Check if it's a permanent error (invalid refresh token)
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        if (
          errorMessage.includes('invalid_grant') ||
          errorMessage.includes('token has been expired or revoked') ||
          errorMessage.includes('invalid refresh token')
        ) {
          console.error(`[GmailTokenManager] Refresh token is invalid for account ${this.accountId}. User needs to re-authenticate.`);

          // Mark account as inactive to prevent further attempts
          await db.emailAccount.update({
            where: { id: this.accountId },
            data: { isActive: false },
          });

          throw new Error('Gmail refresh token is invalid. Please reconnect your account.');
        }
      }

      throw error;
    }
  }

  /**
   * Update stored tokens in the database
   */
  private async updateStoredTokens(credentials: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  }): Promise<void> {
    try {
      await db.emailAccount.update({
        where: { id: this.accountId },
        data: {
          accessToken: credentials.access_token ?? undefined,
          refreshToken: credentials.refresh_token ?? undefined,
          expiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : null,
        },
      });

      console.log(`[GmailTokenManager] Updated stored tokens for account ${this.accountId}`);
    } catch (error) {
      console.error(`[GmailTokenManager] Failed to update stored tokens for account ${this.accountId}:`, error);
      throw error;
    }
  }
}