import { Mail, Archive, LucideIcon } from 'lucide-react';

export interface ProviderStyle {
  icon: LucideIcon;
  iconColor: string;
}

export const PROVIDER_STYLES: Record<string, ProviderStyle> = {
  gmail: {
    icon: Mail,
    iconColor: 'text-red-600',
  },
  archive: {
    icon: Archive,
    iconColor: 'text-purple-600',
  },
  default: {
    icon: Mail,
    iconColor: 'text-blue-600',
  },
};

export const SYNC_STATUS_STYLES = {
  syncing: 'bg-blue-600 animate-pulse',
  error: 'bg-red-600',
  idle: 'bg-green-600',
  default: 'bg-gray-400',
} as const;

export const JOB_TYPE_COLORS = {
  full_sync: 'text-blue-600',
  incremental_sync: 'text-green-600',
  folder_sync: 'text-purple-600',
  cleanup: 'text-gray-600',
  default: 'text-gray-800',
} as const;

export function getProviderStyle(provider: string): ProviderStyle {
  return PROVIDER_STYLES[provider] || PROVIDER_STYLES.default;
}

export function getSyncStatusStyle(status: string): string {
  return SYNC_STATUS_STYLES[status as keyof typeof SYNC_STATUS_STYLES] || SYNC_STATUS_STYLES.default;
}

export function getJobTypeColor(taskIdentifier: string): string {
  if (taskIdentifier.includes('full_sync')) return JOB_TYPE_COLORS.full_sync;
  if (taskIdentifier.includes('incremental_sync')) return JOB_TYPE_COLORS.incremental_sync;
  if (taskIdentifier.includes('folder_sync')) return JOB_TYPE_COLORS.folder_sync;
  if (taskIdentifier.includes('cleanup')) return JOB_TYPE_COLORS.cleanup;
  return JOB_TYPE_COLORS.default;
}