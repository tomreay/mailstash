import {SyncCheckpoint} from '@/lib/services/job-status.service';

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
