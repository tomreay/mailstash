export interface ParsedEmailAddress {
  name: string;
  email: string;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
  accountId: string;
  gmailLabelId: string | null;
  lastSyncId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Email {
  id: string;
  messageId: string;
  threadId: string | null;
  subject: string | null;
  from: string;
  to: string;
  cc: string | null;
  bcc: string | null;
  replyTo: string | null;
  date: Date | string;
  textContent?: string | null;
  htmlContent?: string | null;
  hasAttachments: boolean;
  isRead: boolean;
  isImportant: boolean;
  isSpam: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  category: string | null;
  labels: string | string[]; // Can be JSON string or parsed array
  emlPath: string | null;
  size: number | null;
  accountId: string;
  folderId: string | null;
  gmailId: string | null;
  gmailThreadId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  filePath: string;
  emailId: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface EmailsResponse {
  emails: EmailListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmailListItem {
  id: string;
  messageId: string;
  subject: string | null;
  from: string;
  to: string;
  date: string;
  isRead: boolean;
  isImportant: boolean;
  hasAttachments: boolean;
  labels: string[];
  snippet: string;
  markedForDeletion: boolean;
}

export interface EmailDetail extends Omit<Email, 'labels'> {
  labels: string[];
  attachments: Attachment[];
  folder: Folder | null;
}

// Stats types
export interface StatsResponse {
  totalEmails: number;
  unreadEmails: number;
  totalAttachments: number;
  storageUsed: number;
  lastSyncAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
}

// Sync types
export interface SyncResponse {
  message?: string;
  accountId?: string;
  jobId?: string;
  status?: 'idle' | 'syncing' | 'error';
  lastSyncAt?: string | null;
  error?: string | null;
}
