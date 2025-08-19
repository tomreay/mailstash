import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  EmailAccountSettingsClient,
  AutoDeleteMode,
} from '@/lib/types/account-settings';
import { confirmAction } from '@/lib/utils/confirm';
import { SUCCESS_MESSAGE_DURATION } from '@/lib/constants/settings';

interface UseSettingsManagerOptions {
  accountId: string;
  settings: EmailAccountSettingsClient | null;
  setSettings: (settings: EmailAccountSettingsClient) => void;
  setDryRunStatus: (status: any) => void;
}

export function useSettingsManager({
  accountId,
  settings,
  setSettings,
  setDryRunStatus,
}: UseSettingsManagerOptions) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDryRunLoading, setIsDryRunLoading] = useState(false);

  const handleSaveSettings = useCallback(
    async (
      updatedSettings?: Partial<EmailAccountSettingsClient>
    ): Promise<boolean> => {
      if (!settings) return false;

      const settingsToSave = updatedSettings
        ? { ...settings, ...updatedSettings }
        : settings;

      setSaving(true);
      setError(null);
      setSuccess(false);

      try {
        const res = await fetch(`/api/accounts/${accountId}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            syncFrequency: settingsToSave.syncFrequency,
            syncPaused: settingsToSave.syncPaused,
            autoDeleteMode: settingsToSave.autoDeleteMode,
            deleteDelayHours: settingsToSave.deleteDelayHours,
            deleteAgeMonths: settingsToSave.deleteAgeMonths,
            deleteOnlyArchived: settingsToSave.deleteOnlyArchived,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to save settings');
        }

        const data = await res.json();
        setSettings(settingsToSave);
        setSuccess(true);
        setTimeout(() => setSuccess(false), SUCCESS_MESSAGE_DURATION);

        if (data.dryRunTriggered) {
          router.push(`/accounts/${accountId}/dry-run`);
        }

        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to save settings'
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [accountId, settings, setSettings, router]
  );

  const handleRunDryRun = useCallback(async () => {
    if (!settings) return;

    setIsDryRunLoading(true);
    setError(null);

    try {
      await handleSaveSettings({ autoDeleteMode: 'dry-run' as AutoDeleteMode });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start dry-run');
    } finally {
      setIsDryRunLoading(false);
    }
  }, [settings, handleSaveSettings]);

  const handleDisableAutoDelete = useCallback(async () => {
    setIsDryRunLoading(true);

    try {
      await handleSaveSettings({ autoDeleteMode: 'off' as AutoDeleteMode });
      setDryRunStatus(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to disable auto-delete'
      );
    } finally {
      setIsDryRunLoading(false);
    }
  }, [handleSaveSettings, setDryRunStatus]);

  const handleDeleteAccount = useCallback(async () => {
    const confirmed = confirmAction(
      'Are you sure you want to delete this account? This will delete all associated emails and data.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        setError('Failed to delete account');
        return;
      }

      router.push('/accounts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    }
  }, [accountId, router]);

  return {
    saving,
    error,
    setError,
    success,
    isDryRunLoading,
    handleSaveSettings,
    handleRunDryRun,
    handleDisableAutoDelete,
    handleDeleteAccount,
  };
}
