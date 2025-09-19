import { Folder } from '@/types';
import { EmailAccount } from '@/types/email';
import { SyncCheckpoint } from '@/lib/services/job-status.service';

export interface SyncJobPayload {
  accountId: string;
}

export interface FullSyncPayload extends SyncJobPayload {
  resumeFromCheckpoint?: SyncCheckpoint;
}

export interface IncrementalSyncPayload extends SyncJobPayload {
  lastSyncAt?: string;
  gmailHistoryId?: string;
  imapUidValidity?: string;
}

export interface FolderSyncPayload extends SyncJobPayload {
  folderId: string;
  folderPath: string;
  lastSyncId?: string;
}

export interface JobResult {
  success: boolean;
  emailsProcessed?: number;
  errors?: string[];
  nextSyncData?: {
    gmailHistoryId?: string;
    lastSyncId?: string;
  };
}

export interface EmailAccountWithFolders extends EmailAccount {
  folders: Folder[];
}

