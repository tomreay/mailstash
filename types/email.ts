export interface EmailMessage {
  id: string
  messageId: string
  threadId?: string
  subject?: string
  from: string
  to: string
  cc?: string
  bcc?: string
  replyTo?: string
  date: Date
  textContent?: string
  htmlContent?: string
  hasAttachments: boolean
  attachments?: EmailAttachment[]
  labels?: string[]
  category?: string
  size?: number
  isRead: boolean
  isImportant: boolean
  isSpam: boolean
  isArchived: boolean
  isDeleted: boolean
}

export interface EmailAttachment {
  filename: string
  contentType: string
  size: number
  content: Buffer
}

export interface EmailAccount {
  id: string
  email: string
  displayName?: string | null
  provider: 'gmail' | 'imap' | string
  accessToken?: string | null
  refreshToken?: string | null
  expiresAt?: Date | null
  isActive: boolean
  
  // Gmail-specific
  gmailId?: string | null
  
  // IMAP-specific
  imapHost?: string | null
  imapPort?: number | null
  imapSecure?: boolean | null
  imapUser?: string | null
  imapPass?: string | null
}

export interface EmailFolder {
  id: string
  name: string
  path: string
  accountId: string
  gmailLabelId?: string
}

export interface SyncStatus {
  accountId: string
  lastSyncAt?: Date
  syncStatus: 'idle' | 'syncing' | 'error'
  errorMessage?: string
  gmailHistoryId?: string
}

export interface FilterRule {
  id: string
  name: string
  accountId: string
  conditions: FilterCondition[]
  action: 'delete' | 'archive' | 'label' | 'move'
  actionValue?: string
  isActive: boolean
}

export interface FilterCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'hasAttachments'
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex'
  value: string
}