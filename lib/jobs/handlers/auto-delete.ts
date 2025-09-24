import { createJobHandler } from '../create-handler';
import { performAutoDelete } from '@/lib/services/auto-delete-service';
import { db } from '@/lib/db';
import { AutoDeleteMode } from '@/lib/types/account-settings';

export interface AutoDeleteJobData {
  accountId: string;
}

export const autoDeleteHandler = createJobHandler<AutoDeleteJobData>(
  'auto_delete',
  async ({ account }) => {
    // Get account settings
    const accountWithSettings = await db.emailAccount.findUnique({
      where: { id: account.id },
      include: { settings: true },
    });

    if (!accountWithSettings?.settings) {
      console.log(`[auto-delete] No settings found for account ${account.id}`);
      return {
        skipped: true,
        reason: 'No account settings found',
      };
    }

    const settings = {
      ...accountWithSettings.settings,
      autoDeleteMode: accountWithSettings.settings.autoDeleteMode as AutoDeleteMode,
    };

    // Perform auto-delete
    const result = await performAutoDelete(account, settings);

    console.log('[auto-delete] Job completed:', result);

    if (!result.success && result.error) {
      // Non-critical errors (like "off" mode) don't need to be thrown
      if (result.mode === 'off' || result.error === 'No deletion rules configured') {
        return {
          skipped: true,
          reason: result.error,
          mode: result.mode,
        };
      }
      // Throw for actual errors
      throw new Error(result.error);
    }

    return {
      mode: result.mode,
      count: result.count,
    };
  }
);