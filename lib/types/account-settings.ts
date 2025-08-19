/**
 * Centralized types for Email Account Settings
 */

export type AutoDeleteMode = 'off' | 'dry-run' | 'on';

/**
 * Core account settings stored in the database
 */
export interface EmailAccountSettings {
  id: string;
  accountId: string;
  syncFrequency: string;
  syncPaused: boolean;
  autoDeleteMode: AutoDeleteMode;
  deleteDelayHours: number | null;
  deleteAgeMonths: number | null;
  deleteOnlyArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Partial settings for updates - all fields optional except those that are being updated
 */
export type UpdateEmailAccountSettings = {
  syncFrequency?: string;
  syncPaused?: boolean;
  autoDeleteMode?: AutoDeleteMode;
  deleteDelayHours?: number | null;
  deleteAgeMonths?: number | null;
  deleteOnlyArchived?: boolean;
};

/**
 * Client-side settings (dates as strings for JSON serialization)
 */
export interface EmailAccountSettingsClient {
  id: string;
  accountId: string;
  syncFrequency: string;
  syncPaused: boolean;
  autoDeleteMode: AutoDeleteMode;
  deleteDelayHours: number | null;
  deleteAgeMonths: number | null;
  deleteOnlyArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Settings summary for account list views
 */
export interface EmailAccountSettingsSummary {
  syncFrequency: string;
  syncPaused: boolean;
  autoDeleteMode: AutoDeleteMode;
}

/**
 * Convert database settings to client format
 */
export function toClientSettings(
  settings: EmailAccountSettings
): EmailAccountSettingsClient {
  return {
    ...settings,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

/**
 * Default settings for new accounts
 */
export const DEFAULT_ACCOUNT_SETTINGS: Omit<
  EmailAccountSettings,
  'id' | 'accountId' | 'lastDeleteRunAt' | 'createdAt' | 'updatedAt'
> = {
  syncFrequency: '0 * * * *', // Hourly by default
  syncPaused: false,
  autoDeleteMode: 'off',
  deleteDelayHours: null,
  deleteAgeMonths: null,
  deleteOnlyArchived: true,
};
