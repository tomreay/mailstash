import { Folder } from '@/types';
import { EmailAccount, SyncStatus } from '@/types/email';

export interface SyncJobPayload {
  accountId: string;
}

export interface FullSyncPayload extends SyncJobPayload {
  resumeFromCheckpoint?: {
    lastProcessedFolder?: string;
    lastProcessedMessageId?: string;
  };
}

export interface IncrementalSyncPayload extends SyncJobPayload {
  lastSyncAt?: string;
  gmailHistoryId?: string;
  imapUidValidity?: string;
}

export interface FolderSyncPayload extends SyncJobPayload {
  folderId: string;
  folderPath: string;
  lastImapUid?: string;
}

export interface JobResult {
  success: boolean;
  emailsProcessed?: number;
  errors?: string[];
  nextSyncData?: {
    gmailHistoryId?: string;
    lastImapUid?: string;
  };
}

export interface EmailAccountWithFolders extends EmailAccount {
  folders: Folder[];
}

export interface EmailAccountWithSyncStatus extends EmailAccount {
  syncStatus: SyncStatus | null;
}
